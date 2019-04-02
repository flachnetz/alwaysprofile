package main

import (
	"context"
	"github.com/NYTimes/gziphandler"
	"github.com/flachnetz/startup"
	base "github.com/flachnetz/startup/startup_base"
	ht "github.com/flachnetz/startup/startup_http"
	po "github.com/flachnetz/startup/startup_postgres"
	"github.com/jmoiron/sqlx"
	"github.com/jmoiron/sqlx/types"
	"github.com/julienschmidt/httprouter"
	"github.com/pkg/errors"
	"net/http"
	"time"
)

func main() {
	var opts struct {
		Base     base.BaseOptions
		Postgres po.PostgresOptions
		HTTP     ht.HTTPOptions
	}

	startup.MustParseCommandLine(&opts)

	db := opts.Postgres.Connection()

	repo := NewRepository()

	err := po.WithTransactionContext(context.Background(), db,
		func(ctx context.Context, tx *sqlx.Tx) error { return repo.FillCache(ctx) })

	base.FatalOnError(err, "Preload caches failed")

	opts.HTTP.Serve(ht.Config{
		Name: "rest",
		Routing: func(router *httprouter.Router) http.Handler {
			router.GET("/api/v1/services", HandlerServices(db))
			router.GET("/api/v1/services/:service/stack", HandlerStack(db, repo))
			router.GET("/api/v1/services/:service/histogram", HandlerHistogram(db))
			router.ServeFiles("/ui/*filepath", http.Dir("./ui/dist/ui/"))
			return gziphandler.GzipHandler(router)
		},
	})
}

func HandlerServices(db *sqlx.DB) httprouter.Handle {
	type Response struct {
		Services []string `json:"services"`
	}

	return func(writer http.ResponseWriter, request *http.Request, params httprouter.Params) {
		var opts struct {
		}

		ht.ExtractAndCall(&opts, writer, request, params, func() (interface{}, error) {
			services, err := queryServiceNames(request.Context(), db)
			if err != nil {
				return nil, errors.WithMessage(err, "list services")
			}

			return Response{Services: services}, nil
		})
	}
}

func HandlerStack(db *sqlx.DB, repo *Repository) httprouter.Handle {
	return func(writer http.ResponseWriter, request *http.Request, params httprouter.Params) {
		var opts struct {
			Service string `validate:"required" path:"service"`
		}

		ht.ExtractAndCall(&opts, writer, request, params, func() (interface{}, error) {
			return queryStack(request.Context(), db, repo, opts.Service)
		})
	}
}

func HandlerHistogram(db *sqlx.DB) httprouter.Handle {
	return func(writer http.ResponseWriter, request *http.Request, params httprouter.Params) {
		var opts struct {
			Service string `validate:"required" path:"service"`
		}

		ht.ExtractAndCall(&opts, writer, request, params, func() (interface{}, error) {
			return queryHistogram(request.Context(), db, opts.Service)
		})
	}
}

func queryServiceNames(ctx context.Context, db *sqlx.DB) ([]string, error) {
	var names []string
	err := db.SelectContext(ctx, &names, `SELECT name FROM ap_service ORDER BY name ASC`)
	return names, errors.WithMessage(err, "list services")
}

func queryHistogram(ctx context.Context, db *sqlx.DB, serviceName string) (interface{}, error) {
	var histogram []struct {
		InstanceId  int     `json:"instanceId" db:"instance_id"`
		TimeSlot    int     `json:"timeslot" db:"time"`
		Occurrences int     `json:"sampleCount" db:"occurrences"`
		Count       float32 `json:"duration" db:"duration"`
	}

	err := po.WithTransactionContext(ctx, db, func(ctx context.Context, tx *sqlx.Tx) error {
		const binSize = 60 * time.Second

		return tx.SelectContext(ctx, &histogram, `
			SELECT
				instance_id,
			       1000*min(timeslot)::INT8 as time,
			       sum(duration) as duration,
			       sum(occurrences) as occurrences
			
			FROM ap_sample AS sample
			  JOIN ap_instance AS instance ON sample.instance_id = instance.id
				JOIN ap_service AS service ON instance.service_id = service.id
			WHERE service.name = $2
			GROUP BY instance_id, $1*(timeslot/$1)::INT`,

			binSize/time.Second, serviceName)
	})

	return histogram, err
}

type Stack struct {
	Methods          []string `json:"methods"`
	DurationInMillis int32    `json:"durationInMillis"`
}

func queryStack(ctx context.Context, db *sqlx.DB, repo *Repository, serviceName string) ([]Stack, error) {
	var stacks []Stack

	err := po.WithTransactionContext(ctx, db, func(ctx context.Context, tx *sqlx.Tx) error {
		var dbStacks []struct {
			DurationMillis int32          `db:"duration"`
			MethodIds      types.JSONText `db:"methods"`
		}

		timeMin := 0
		timeMax := time.Now().Unix()

		err := tx.SelectContext(ctx, &dbStacks, `
			    WITH samples_unnest AS (
            SELECT unnest(items) AS item
            FROM ap_sample
            WHERE instance_id IN (SELECT id FROM ap_instance WHERE service_id = (SELECT id FROM ap_service WHERE name = $1))
              AND timeslot BETWEEN $2 AND $3),
        
          merged AS (
            SELECT (item).stack_id as stack_id, sum((item).duration) as duration
            FROM samples_unnest
            GROUP BY (item).stack_id)
        
          SELECT merged.duration as duration, stack.methods as methods
          FROM merged
            JOIN ap_stack AS stack ON (merged.stack_id = stack.id);`, serviceName, timeMin, timeMax)

		// lookup table for method names
		lookupTable := map[int32]string{}

		for _, dbStack := range dbStacks {
			var methodIds []int32
			if err := dbStack.MethodIds.Unmarshal(&methodIds); err != nil {
				return errors.WithMessage(err, "decode method ids")
			}

			var methods []string
			for _, id := range methodIds {
				name, ok := lookupTable[id]
				if !ok {
					name, err = repo.MethodName(ctx, id)
					if err != nil {
						return errors.WithMessage(err, "lookup method name")
					}

					lookupTable[id] = name
				}

				methods = append(methods, name)
			}

			stacks = append(stacks, Stack{
				Methods:          methods,
				DurationInMillis: dbStack.DurationMillis,
			})
		}

		if err != nil {
			return errors.WithMessage(err, "query grouped samples")
		}

		return nil
	})

	return stacks, err
}
