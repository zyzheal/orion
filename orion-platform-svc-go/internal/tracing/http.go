package tracing

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
)

const httpSpanPrefix = "http."

type HTTPSpan struct {
	ctx    context.Context
	span   oteltrace.Span
	method string
	url    string
}

func NewHTTPSpan(ctx context.Context, tracer oteltrace.Tracer, method, url string) HTTPSpan {
	name := fmt.Sprintf("%s%s", httpSpanPrefix, method)
	name = strings.ToLower(name)

	attrs := []attribute.KeyValue{
		attribute.String("http.method", method),
		attribute.String("http.url", url),
	}

	spCtx := StartSpan(ctx, tracer, name,
		withKind(oteltrace.SpanKindClient),
		withAttrs(attrs...),
	)

	return HTTPSpan{ctx: spCtx.Ctx, span: spCtx.Span, method: method, url: url}
}

func (h HTTPSpan) Do(req *http.Request) (*http.Response, error) {
	start := time.Now()
	resp, err := http.DefaultTransport.RoundTrip(req.WithContext(h.ctx))
	elapsed := time.Since(start)

	h.span.SetAttributes(attribute.Int64("http.duration.ms", int64(elapsed.Milliseconds())))

	if resp != nil {
		h.span.SetAttributes(attribute.Int("http.status_code", resp.StatusCode))
		if resp.StatusCode >= 400 {
			h.span.SetStatus(codes.Error, fmt.Sprintf("http %d", resp.StatusCode))
		}
	}

	if err != nil {
		h.span.RecordError(err)
		h.span.SetStatus(codes.Error, "http request error")
	}
	h.span.End()
	return resp, err
}

func (h HTTPSpan) DoWithBody(req *http.Request) ([]byte, error) {
	resp, err := h.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		h.span.RecordError(err)
		h.span.SetStatus(codes.Error, "read response body error")
		return nil, err
	}
	h.span.SetAttributes(attribute.Int("http.response.size", len(body)))
	return body, nil
}

func (h HTTPSpan) Get() ([]byte, error) {
	req, err := http.NewRequestWithContext(h.ctx, http.MethodGet, h.url, nil)
	if err != nil {
		h.span.RecordError(err)
		h.span.SetStatus(codes.Error, "create request error")
		h.span.End()
		return nil, err
	}
	return h.DoWithBody(req)
}

func (h HTTPSpan) PostJSON(body []byte) ([]byte, error) {
	req, err := http.NewRequestWithContext(h.ctx, http.MethodPost, h.url,
		io.NopCloser(strings.NewReader(string(body))))
	if err != nil {
		h.span.RecordError(err)
		h.span.SetStatus(codes.Error, "create request error")
		h.span.End()
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return h.DoWithBody(req)
}

func (h HTTPSpan) End(err error) {
	if err != nil {
		h.span.RecordError(err)
		h.span.SetStatus(codes.Error, "http error")
	}
	h.span.End()
}
