FROM golang:1.12.1-alpine3.9 as go-builder

# git is required to download go dependencies
RUN apk add --no-cache git

ENV GO111MODULE=on GOPATH=/go

WORKDIR /go/src/github.com/flachnetz/alwaysprofile/rest/

COPY go.mod .
RUN go mod download

COPY . .
RUN go build -v -o /rest .


FROM node:11.12.0-alpine as js-builder
EXPOSE 3080

WORKDIR /src
COPY ui/package*json ./
RUN npm install

COPY ui/ ./
RUN npm run build -- --prod

FROM alpine:3.9
EXPOSE 3080

COPY --from=go-builder /rest /rest
COPY --from=js-builder /src/dist/ /ui/dist/

ENTRYPOINT ["/rest", "--verbose"]
