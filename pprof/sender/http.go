package sender

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/flachnetz/alwaysprofile/pprof"
	"net/http"
	"net/url"
	"strconv"
	"time"
	"unicode"
)

type Config struct {
	Client  *http.Client
	BaseURL *url.URL
	Timeout time.Duration
}

type sender struct {
	Config
}

func New(config Config) pprof.Sender {
	if config.Client == nil {
		config.Client = http.DefaultClient
	}

	return &sender{Config: config}
}

func (sender *sender) Send(p *pprof.Profile) error {
	payload := serializeAsJson(p)

	req, err := http.NewRequest("POST", sender.BaseURL.String(), bytes.NewReader(payload))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "gzip")

	ctx := context.Background()
	if sender.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, sender.Timeout)
		defer cancel()
	}

	resp, err := sender.Client.Do(req)
	if err != nil {
		return err
	}

	// clear the response
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("expected 2xx response, got %d", resp.StatusCode)
	}

	return nil
}

func serializeAsJson(prof *pprof.Profile) []byte {
	var w jsonWriter

	w.BeginObject()
	{
		w.WriteField("start")
		w.WriteInterface(prof.Start)

		w.WriteField("serviceName")
		w.WriteString(prof.ServiceName)

		w.WriteField("instanceId")
		w.WriteString(prof.InstanceId.String())

		w.WriteField("tags")
		w.BeginObject()
		for key, value := range prof.Tags {
			w.WriteField(key)
			w.WriteString(value)
		}
		w.EndObject()

		w.WriteField("names")
		w.BeginArray()
		for _, name := range prof.Names {
			w.WriteString(name)
		}
		w.EndArray()

		w.WriteField("samples")
		w.BeginArray()
		{
			for _, sample := range prof.Samples {
				w.BeginObject()
				{
					w.WriteField("timestampNs")
					w.WriteInt64(int64(sample.TimestampNs))

					w.WriteField("durationNs")
					w.WriteInt64(int64(sample.Duration))

					w.WriteField("stack")
					w.BeginArray()
					for _, loc := range sample.Stack {
						w.WriteInt32(int32(loc))
					}

					w.EndArray()
				}
				w.EndObject()
			}
		}
		w.EndArray()
	}
	w.EndObject()

	return w.buf.Bytes()
}

// very fast and simple json writer without any reflection or magic.
type jsonWriter struct {
	buf     bytes.Buffer
	scratch [64]byte

	requireComma uint64
}

func (j *jsonWriter) BeginObject() {
	j.writeComma()

	j.requireComma <<= 1
	j.buf.WriteByte('{')
}

func (j *jsonWriter) EndObject() {
	j.requireComma >>= 1
	j.buf.WriteByte('}')
}

func (j *jsonWriter) BeginArray() {
	j.writeComma()

	j.requireComma <<= 1
	j.buf.WriteByte('[')
}

func (j *jsonWriter) EndArray() {
	j.requireComma >>= 1
	j.buf.WriteByte(']')
}

func (j *jsonWriter) WriteField(name string) {
	j.WriteString(name)
	j.buf.WriteByte(':')

	// the next element on this level does not require a comma (it got the colon)
	j.requireComma &^= 1
}

func (j *jsonWriter) WriteInt32(value int32) {
	j.writeComma()

	formatted := strconv.AppendInt(j.scratch[:0], int64(value), 10)
	j.buf.Write(formatted)
}

func (j *jsonWriter) WriteInt64(value int64) {
	j.writeComma()

	formatted := strconv.AppendInt(j.scratch[:0], value, 10)
	j.buf.Write(formatted)
}

func (j *jsonWriter) WriteString(value string) {
	j.writeComma()

	if isSimpleString(value) {
		j.buf.WriteByte('"')
		j.buf.WriteString(value)
		j.buf.WriteByte('"')
	} else {
		b, _ := json.Marshal(value)
		j.buf.Write(b)
	}
}

func (j *jsonWriter) WriteInterface(v json.Marshaler) {
	j.writeComma()

	b, _ := v.MarshalJSON()
	j.buf.Write(b)
}

func (j *jsonWriter) writeComma() {
	if j.requireComma&1 == 0 {
		j.requireComma |= 1
	} else {
		j.buf.WriteByte(',')
	}
}

func isSimpleString(s string) bool {
	for i := 0; i < len(s); i++ {
		ch := s[i]

		if (ch < ' ' || ch == '\\' || ch == '"') || s[i] > unicode.MaxASCII {
			return false
		}
	}

	return true
}
