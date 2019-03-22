package main

import (
	"encoding/json"
	"fmt"
	"github.com/NYTimes/gziphandler"
	"github.com/flachnetz/startup"
	"github.com/flachnetz/startup/startup_http"
	"github.com/flachnetz/startup/startup_postgres"
	"github.com/julienschmidt/httprouter"
	"log"
	"net/http"
)

func main() {
	var opts struct {
		Base     startup.BaseOptions
		Postgres startup_postgres.PostgresOptions
		HTTP     startup_http.HTTPOptions
	}

	opts.Postgres.Inputs.Initializer = startup_postgres.DefaultMigration("ap_schema")

	startup.MustParseCommandLine(&opts)

	db := opts.Postgres.Connection()

	ingester := NewIngester(db)

	err := ingester.fillCaches(db)
	startup.FatalOnError(err, "Could not fill method name cache")

	opts.HTTP.Serve(startup_http.Config{
		Name: "ingest",
		Routing: func(router *httprouter.Router) http.Handler {
			router.POST("/v1/profile", HandlerIngest(ingester))
			return gziphandler.GzipHandler(router)
		},
	})
}

func HandlerIngest(ingester *Ingester) httprouter.Handle {

	return func(writer http.ResponseWriter, request *http.Request, params httprouter.Params) {
		var body Profile

		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			log.Println(err)
			http.Error(writer, err.Error(), http.StatusBadRequest)
			return
		}

		if err := ingester.Ingest(body); err != nil {
			fmt.Println(err)
			http.Error(writer, err.Error(), http.StatusInternalServerError)
			return
		}
	}
}
