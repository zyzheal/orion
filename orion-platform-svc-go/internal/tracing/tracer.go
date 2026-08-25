package tracing

import (
	"context"

	"go.opentelemetry.io/otel"
	oteltrace "go.opentelemetry.io/otel/trace"
)

// TracerManager provides unified access to all span types.
type TracerManager struct {
	tracer oteltrace.Tracer
}

// NewTracerManager creates a new TracerManager with the given service name.
func NewTracerManager(serviceName string) *TracerManager {
	return &TracerManager{
		tracer: otel.Tracer(serviceName),
	}
}

func (tm *TracerManager) NewDBSpan(ctx context.Context, operation, sqlQuery string) DBSpan {
	return NewDBSpan(ctx, tm.tracer, nil, operation, sqlQuery)
}

func (tm *TracerManager) NewRedisSpan(ctx context.Context, cmd, key string) RedisSpan {
	return NewRedisSpan(ctx, tm.tracer, nil, cmd, key)
}

func (tm *TracerManager) NewHTTPSpan(ctx context.Context, method, url string) HTTPSpan {
	return NewHTTPSpan(ctx, tm.tracer, method, url)
}

func (tm *TracerManager) NewMessageSpan(ctx context.Context, operation, topic string) MessageSpan {
	return NewMessageSpan(ctx, tm.tracer, operation, topic)
}

func (tm *TracerManager) NewSpan(ctx context.Context, name string, opts ...spanOptions) SpanContext {
	return StartSpan(ctx, tm.tracer, name, opts...)
}

func (tm *TracerManager) Tracer() oteltrace.Tracer {
	return tm.tracer
}

func (tm *TracerManager) ContextWithSpan(ctx context.Context, name string) (context.Context, oteltrace.Span) {
	return tm.tracer.Start(ctx, name)
}

var Global = NewTracerManager("orion-platform")
