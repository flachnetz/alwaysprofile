FROM golang:1.12.1-alpine3.9 as go-builder

# git is required to download go dependencies
RUN apk add --no-cache git

ENV GO111MODULE=on GOPATH=/go

WORKDIR /go/src/github.com/flachnetz/alwaysprofile/ingest/

COPY go.mod .
RUN go mod download

COPY . .
RUN go build -v -o /ingest .

#
FROM alpine:3.9

COPY /sql /sql
COPY --from=go-builder /ingest /ingest

ENTRYPOINT ["/ingest", "--verbose"]
