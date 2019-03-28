package main

import (
	"context"
	"github.com/NYTimes/gziphandler"
	"github.com/flachnetz/startup"
	. "github.com/flachnetz/startup/startup_base"
	base "github.com/flachnetz/startup/startup_base"
	"github.com/flachnetz/startup/startup_http"
	"github.com/flachnetz/startup/startup_postgres"
	"github.com/julienschmidt/httprouter"
	"net/http"
)

func main() {
	var opts struct {
		Base     base.BaseOptions
		Postgres startup_postgres.PostgresOptions
		HTTP     startup_http.HTTPOptions
	}

	opts.Postgres.Inputs.Initializer = startup_postgres.DefaultMigration("ap_schema")

	startup.MustParseCommandLine(&opts)

	db := opts.Postgres.Connection()

	ingester := NewIngester(db)

	err := ingester.fillCaches(context.Background(), db)
	FatalOnError(err, "Could not fill method name cache")

	opts.HTTP.Serve(startup_http.Config{
		Name: "ingest",
		Routing: func(router *httprouter.Router) http.Handler {
			router.POST("/v1/profile", HandlerIngest(ingester))
			return gziphandler.GzipHandler(router)
		},
	})
}

func HandlerIngest(ingester *Ingester) httprouter.Handle {
	return func(w http.ResponseWriter, r *http.Request, params httprouter.Params) {
		var body Profile

		startup_http.ExtractAndCallWithBody(nil, &body, w, r, params, func() (interface{}, error) {
			err := ingester.Ingest(r.Context(), body)
			return nil, err
		})
	}
}
