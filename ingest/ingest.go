package main

import (
	"bytes"
	"database/sql"
	"database/sql/driver"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"github.com/flachnetz/startup/lib/transaction"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/jmoiron/sqlx/types"
	"github.com/lib/pq"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
	"hash/fnv"
	"io"
	"sort"
	"strconv"
	"sync"
	"time"
)

type existsValue struct{}

type Ingester struct {
	db *sqlx.DB

	methodCacheLock sync.Mutex
	methodCache     map[string]int32

	stackCacheLock sync.Mutex
	stackCache     map[int64]existsValue

	serviceCacheLock sync.Mutex
	serviceCache     map[string]int32

	instanceCacheLock sync.Mutex
	instanceCache     map[uuid.UUID]int32
}

func NewIngester(db *sqlx.DB) *Ingester {
	return &Ingester{
		db: db,

		methodCache:   map[string]int32{},
		stackCache:    map[int64]existsValue{},
		serviceCache:  map[string]int32{},
		instanceCache: map[uuid.UUID]int32{},
	}
}

type Stack struct {
	Id      int64
	Methods []int32
}

func (ingester *Ingester) Ingest(profile Profile) error {
	type SampleKey struct {
		Timeslot   int32
		InstanceId int32
	}

	return transaction.WithTransaction(ingester.db, func(tx *sqlx.Tx) error {
		serviceId, err := ingester.serviceId(tx, profile.ServiceName)
		if err != nil {
			return errors.WithMessage(err, "ensure service exists")
		}

		instanceId, err := ingester.instanceId(tx, serviceId, profile.InstanceId, profile.Tags)
		if err != nil {
			return errors.WithMessage(err, "ensure instance exists")
		}

		var stacks []Stack

		for _, sample := range profile.Samples {
			// transform local method ids into a list of global method ids.
			var methodIds []int32
			for _, frame := range sample.Stack {
				methodId, err := ingester.methodId(tx, profile.Names[frame])
				if err != nil {
					return errors.WithMessage(err, "lookup method")
				}

				// transpose into arrays
				methodIds = append(methodIds, methodId)
			}

			// calculate stack id as hash from method ids
			stackId := hashInt32Slice(methodIds)

			stacks = append(stacks, Stack{stackId, methodIds})
		}

		if err := ingester.storeStacks(tx, stacks); err != nil {
			return errors.WithMessage(err, "store stacks")
		}

		stackTimes := map[SampleKey]map[int64]time.Duration{}
		for idx, sample := range profile.Samples {
			stack := stacks[idx]

			// add sample to time timeSlot
			const binSize = 60 * time.Second
			timeSlot := int32(timeSlotOf(time.Unix(0, sample.TimestampNs), binSize).Unix())
			key := SampleKey{timeSlot, instanceId}

			// update timings in aggregation
			items := stackTimes[key]
			if items == nil {
				items = map[int64]time.Duration{}
				stackTimes[key] = items
			}

			items[stack.Id] += time.Duration(sample.DurationNs)
		}

		for key, durations := range stackTimes {
			var previousItems []dbSampleItem

		tryAgain:
			// load the previous sample if it exists
			var row struct {
				Version int32           `db:"version"`
				Items   pq.GenericArray `db:"items"`
			}

			row.Items = pq.GenericArray{A: &previousItems}

			err := tx.Get(&row,
				`SELECT version, items FROM ap_sample WHERE timeslot=$1 AND instance_id=$2`,
				key.Timeslot, key.InstanceId)

			if err != nil && err != sql.ErrNoRows {
				return errors.WithMessage(err, "lookup previous items")
			}

			// add old values to the new durations
			for _, item := range previousItems {
				durations[item.StackId] += item.Duration
			}

			// convert durations back to slice of db types
			var items []dbSampleItem
			for stackId, duration := range durations {
				items = append(items, dbSampleItem{stackId, duration})
			}

			// sort by stack id
			sort.Slice(items, func(i, j int) bool { return items[i].StackId < items[j].StackId })

			var updated int
			err = tx.Get(&updated,
				`INSERT INTO ap_sample (timeslot, instance_id, version, items) VALUES ($1, $2, $3, $4)
				ON CONFLICT (timeslot, instance_id) DO UPDATE
				SET version=$3+1, items=EXCLUDED.items
				WHERE ap_sample.version = $3 RETURNING version`,
				key.Timeslot, key.InstanceId, row.Version, pq.Array(items))

			if err == sql.ErrNoRows {
				logrus.Warn("optimistic locking error")
				goto tryAgain
			}

			if err != nil {
				return errors.WithMessage(err, "update failed")
			}
		}

		return nil
	})
}

type dbSampleItem struct {
	StackId  int64
	Duration time.Duration
}

func (item *dbSampleItem) Scan(src interface{}) error {
	payload := src.([]byte)
	if len(payload) < 2 {
		return errors.New("invalid sample item format")
	}

	if payload[0] != '(' || payload[len(payload)-1] != ')' {
		return errors.New("invalid sample item format, parenthesis not found")
	}

	sepIndex := bytes.IndexByte(payload, ',')
	if sepIndex == -1 {
		return errors.New("invalid sample item format, sep not found")
	}

	stackId, err := strconv.Atoi(string(payload[1:sepIndex]))
	if err != nil {
		return errors.WithMessage(err, "parsing stackId in sample item")
	}

	duration, err := strconv.Atoi(string(payload[sepIndex+1 : len(payload)-1]))
	if err != nil {
		return errors.WithMessage(err, "parsing duration in sample item")
	}

	item.StackId = int64(stackId)
	item.Duration = time.Duration(duration) * time.Millisecond

	return nil
}

func (item dbSampleItem) Value() (driver.Value, error) {
	return fmt.Sprintf("(%d,%d)", item.StackId, item.Duration/time.Millisecond), nil
}

func timeSlotOf(ts time.Time, slotSize time.Duration) time.Time {
	return time.Unix(0, ts.UnixNano()/int64(slotSize)*int64(slotSize))
}

func hashInt32Slice(slice []int32) int64 {
	var scratch [4]byte

	hash := fnv.New64a()

	for _, value := range slice {
		binary.BigEndian.PutUint32(scratch[:], uint32(value))
		_, _ = hash.Write(scratch[:])
	}

	return int64(hash.Sum64())
}

func (ingester *Ingester) methodId(tx *sqlx.Tx, name string) (int32, error) {
	ingester.methodCacheLock.Lock()
	id, ok := ingester.methodCache[name]
	ingester.methodCacheLock.Unlock()

	if ok {
		return id, nil
	}

	// first try to insert
	_, err := tx.Exec(`INSERT INTO ap_method (name) VALUES ($1) ON CONFLICT DO NOTHING`, name)
	if err != nil {
		return 0, errors.WithMessage(err, "store method name")
	}

	// and then select the inserted value
	if err := tx.Get(&id, "SELECT id FROM ap_method WHERE name=$1", name); err != nil {
		return 0, errors.WithMessage(err, "get id of method")
	}

	ingester.methodCacheLock.Lock()
	ingester.methodCache[name] = id
	ingester.methodCacheLock.Unlock()

	return id, nil
}

func (ingester *Ingester) fillCaches(db *sqlx.DB) error {
	return transaction.WithTransaction(db, func(tx *sqlx.Tx) error {
		if err := ingester.fillMethodCache(tx); err != nil {
			return err
		}

		if err := ingester.fillStackCache(tx); err != nil {
			return err
		}

		return nil
	})
}

func (ingester *Ingester) fillMethodCache(tx *sqlx.Tx) error {
	var methods []struct {
		Id   int32  `db:"id"`
		Name string `db:"name"`
	}

	if err := tx.Select(&methods, `SELECT id, name FROM ap_method`); err != nil {
		return errors.WithMessage(err, "query method ids")
	}

	locked(&ingester.methodCacheLock, func() {
		for _, method := range methods {
			ingester.methodCache[method.Name] = method.Id
		}
	})

	return nil
}

func (ingester *Ingester) fillStackCache(tx *sqlx.Tx) error {
	var stackIds []int64

	if err := tx.Select(&stackIds, `SELECT id FROM ap_stack`); err != nil {
		return errors.WithMessage(err, "query stack ids")
	}

	locked(&ingester.stackCacheLock, func() {
		for _, stackId := range stackIds {
			ingester.stackCache[stackId] = existsValue{}
		}
	})

	return nil
}

func (ingester *Ingester) storeStacks(tx *sqlx.Tx, stacks []Stack) error {
	var missingStacks []Stack

	locked(&ingester.stackCacheLock, func() {
		for _, stack := range stacks {
			_, exists := ingester.stackCache[stack.Id]
			if !exists {
				missingStacks = append(missingStacks, stack)
			}
		}
	})

	if len(missingStacks) == 0 {
		return nil
	}

	stmt, err := tx.Prepare(`INSERT INTO ap_stack (id, methods) VALUES ($1, $2) ON CONFLICT DO NOTHING`)
	if err != nil {
		return errors.WithMessage(err, "prepare insert stack stmt")
	}

	defer closeIgnoreErr(stmt)

	for _, stack := range missingStacks {
		if _, err := stmt.Exec(stack.Id, pqJSON(stack.Methods)); err != nil {
			return errors.WithMessage(err, "store stack")
		}
	}

	locked(&ingester.stackCacheLock, func() {
		for _, stack := range missingStacks {
			ingester.stackCache[stack.Id] = existsValue{}
		}
	})

	return nil
}

func (ingester *Ingester) serviceId(tx *sqlx.Tx, serviceName string) (int32, error) {
	var serviceId int32

	ingester.serviceCacheLock.Lock()
	serviceId, ok := ingester.serviceCache[serviceName]
	ingester.serviceCacheLock.Unlock()

	if ok {
		return serviceId, nil
	}

	_, err := tx.Exec(
		`INSERT INTO ap_service (name) VALUES ($1) ON CONFLICT DO NOTHING`,
		serviceName)

	if err != nil {
		return 0, errors.WithMessage(err, "store service name")
	}

	if err := tx.Get(&serviceId, "SELECT id FROM ap_service WHERE name=$1", serviceName); err != nil {
		return 0, errors.WithMessage(err, "lookup service id")
	}

	// store service id in cache
	ingester.serviceCacheLock.Lock()
	ingester.serviceCache[serviceName] = serviceId
	ingester.serviceCacheLock.Unlock()

	return serviceId, nil
}

func (ingester *Ingester) instanceId(tx *sqlx.Tx, serviceId int32, instanceUuid uuid.UUID, tags map[string]string) (int32, error) {
	ingester.instanceCacheLock.Lock()
	instanceId, ok := ingester.instanceCache[instanceUuid]
	ingester.instanceCacheLock.Unlock()

	if ok {
		return instanceId, nil
	}

	_, err := tx.Exec(
		`INSERT INTO ap_instance (service_id, uuid, tags) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
		serviceId, instanceUuid, pqJSON(tags))

	if err != nil {
		return 0, errors.WithMessage(err, "store instance")
	}

	if err := tx.Get(&instanceId, "SELECT id FROM ap_instance WHERE uuid=$1", instanceUuid); err != nil {
		return 0, errors.WithMessage(err, "lookup instance id")
	}

	// store instance id in cache
	ingester.instanceCacheLock.Lock()
	ingester.instanceCache[instanceUuid] = instanceId
	ingester.instanceCacheLock.Unlock()

	return instanceId, nil
}

type Sample struct {
	TimestampNs int64
	DurationNs  int64
	Stack       []int32
}

type Profile struct {
	ServiceName string
	InstanceId  uuid.UUID
	Tags        map[string]string

	Names   []string
	Samples []Sample
}

func pqJSON(v interface{}) types.JSONText {
	b, err := json.Marshal(v)
	if err != nil {
		panic(errors.WithMessage(err, "marshal json"))
	}

	return types.JSONText(b)
}

func locked(m *sync.Mutex, fn func()) {
	m.Lock()
	defer m.Unlock()

	fn()
}

func closeIgnoreErr(closer io.Closer) {
	_ = closer.Close()
}
