package pprof

import (
	"errors"
	"fmt"
	"github.com/google/uuid"
	"log"
	"math/rand"
	"runtime"
	"sync"
	"time"
	"unsafe"
)

type Config struct {
	Sender Sender
	Logger Logger

	ServiceName string
	Tags        map[string]string

	// The runtime routines allow a variable profiling rate,
	// but in practice operating systems cannot trigger signals
	// at more than about 500 Hz, and our processing of the
	// signal is not cheap (mostly getting the stack trace).
	// 100 Hz is a reasonable choice: it is frequent enough to
	// produce useful data, rare enough not to bog down the
	// system, and a nice round number to make it easy to
	// convert sample counts to seconds.
	SampleFrequencyHz int
}

var cpu struct {
	sync.Mutex

	profiler *profiler
}

type profiler struct {
	Config

	instanceId uuid.UUID
	done       chan bool

	collector *Collector
}

func Start(config Config) Stopper {
	if config.SampleFrequencyHz == 0 {
		config.SampleFrequencyHz = 100
	}

	if config.Logger == nil {
		config.Logger = func(format string, args ...interface{}) {
			fmt.Println(fmt.Sprintf(format, args...))
		}
	}

	cpu.Lock()
	defer cpu.Unlock()

	// Double-check .
	if cpu.profiler != nil {
		panic(errors.New("cpu profiling already active"))
	}

	runtime.SetCPUProfileRate(config.SampleFrequencyHz)

	profiler := &profiler{
		Config:     config,
		instanceId: uuid.New(),
		done:       make(chan bool),
		collector:  NewCollector(config.Sender, config.Logger),
	}

	go profiler.loop()

	return profiler
}

func (p *profiler) loop() {
	defer close(p.done)

	var profile *Profile
	for {
		if profile == nil {
			profile = &Profile{
				Start:       time.Now(),
				ServiceName: p.ServiceName,
				InstanceId:  p.instanceId,
				Tags:        p.Tags,

				methodCache:   make(map[string]MethodId),
				locationCache: make(map[uintptr]MethodId),

				period: time.Duration(1e9 / p.Config.SampleFrequencyHz),
			}
		}

		time.Sleep(100 * time.Millisecond)

		data, tags, eof := runtime_pprof_readProfile()
		if err := profile.add(data, tags); err != nil {
			log.Println("Process profile data:", err)
		}

		if eof {
			break
		}

		if time.Since(profile.Start) >= 2*time.Second {
			// p.captureMoreStacks(profile)

			if err := p.collector.Enqueue(profile); err != nil {
				log.Println("Enqueue profile to collector:", err)
			}

			profile = nil
		}
	}

	if err := p.collector.Enqueue(profile); err != nil {
		log.Println("Enqueue profile to collector:", err)
	}
}

type Stopper interface {
	Stop()
}

// StopCPUProfile stops the current CPU profile, if any.
// StopCPUProfile only returns after all the writes for the
// profile have completed.
func (p *profiler) Stop() {
	cpu.Lock()
	defer cpu.Unlock()

	if cpu.profiler != p {
		return
	}

	cpu.profiler = nil
	runtime.SetCPUProfileRate(0)

	<-p.done

	_ = p.collector.Close()
}

func (p *profiler) captureMoreStacks(profile *Profile) {
	var stacks []runtime.StackRecord

	startTime := time.Now()

	var stackSample [16]runtime.StackRecord

	f := sampleGoroutines(stackSample[:])
	fmt.Println(f)

	var parked int
	for _, stack := range stackSample[:] {
		stackAsUint := stack.Stack()

		if len(stackAsUint) == 0 {
			continue
		}

		pc := stackAsUint[0]

		if pc-runtime_gopark > 1024 {
			continue
		}

		loc := profile.locForPC(pc)
		if profile.Names[loc] != "runtime.gopark" {
			continue
		}

		parked++

		// calculate time probability
		duration := time.Duration((2.0 / f) * float64(time.Second))

		stackSlice := *(*[]uint64)(unsafe.Pointer(&stackAsUint))
		profile.addStack(stackSlice, uint64(time.Now().UnixNano()), duration)
	}

	p.Logger("Time to capture goroutine profile: %s", time.Since(startTime))
	p.Logger("Got %d parked stack traces out of %d", parked, len(stacks))
}

func sampleGoroutines(records []runtime.StackRecord) float64 {
	currentGp := runtime_getg()

	r := rand.NewSource(time.Now().UnixNano())

	runtime_stopTheWorld("profile")

	result := float64(len(records)) / float64(len(runtime_allgs))

	for i := range records {
		gpIndex := int(r.Int63()) % len(runtime_allgs)
		gp := runtime_allgs[gpIndex]

		if currentGp == gp {
			continue
		}

		runtime_saveg(^uintptr(0), ^uintptr(0), gp, &records[i])
	}

	runtime_startTheWorld()

	return result
}
