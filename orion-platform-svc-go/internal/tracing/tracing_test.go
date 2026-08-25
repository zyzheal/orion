package tracing

import (
	"context"
	"testing"

	"go.opentelemetry.io/otel/attribute"
	oteltrace "go.opentelemetry.io/otel/trace"
)

func TestTruncateSQL(t *testing.T) {
	short := "SELECT * FROM users"
	if truncateSQL(short) != short {
		t.Errorf("short SQL should not be truncated")
	}

	long := make([]byte, 600)
	for i := range long {
		long[i] = 'x'
	}
	result := truncateSQL(string(long))
	expected := string(long[:500]) + "..."
	if result != expected {
		t.Errorf("long SQL should be truncated to 500 chars + ...")
	}
}

func TestTruncateKey(t *testing.T) {
	short := "user:123"
	if truncateKey(short) != short {
		t.Errorf("short key should not be truncated")
	}

	long := make([]byte, 300)
	for i := range long {
		long[i] = 'x'
	}
	result := truncateKey(string(long))
	expected := string(long[:200]) + "..."
	if result != expected {
		t.Errorf("long key should be truncated to 200 chars + ...")
	}
}

func TestStartSpan(t *testing.T) {
	tracer := oteltrace.NewNoopTracerProvider().Tracer("test")
	ctx := context.Background()

	spCtx := StartSpan(ctx, tracer, "test.operation",
		withKind(oteltrace.SpanKindServer),
		withAttrs(attribute.String("key", "value")),
	)

	if spCtx.Span == nil {
		t.Error("span should not be nil")
	}
	spCtx.End(nil)
}

func TestStartSpanWithNoOpts(t *testing.T) {
	tracer := oteltrace.NewNoopTracerProvider().Tracer("test")
	ctx := context.Background()

	spCtx := StartSpan(ctx, tracer, "simple.operation")
	if spCtx.Span == nil {
		t.Error("span should not be nil")
	}
	spCtx.End(nil)
}

func TestStartSpanWithError(t *testing.T) {
	tracer := oteltrace.NewNoopTracerProvider().Tracer("test")
	ctx := context.Background()

	spCtx := StartSpan(ctx, tracer, "test.operation")
	spCtx.End(nil)
}

func TestSpanFromContext(t *testing.T) {
	tracer := oteltrace.NewNoopTracerProvider().Tracer("test")
	ctx := context.Background()

	ctx, span := tracer.Start(ctx, "test.span")
	defer span.End()

	found, _ := SpanFromContext(ctx)
	if found == nil {
		t.Error("expected non-nil span from context")
	}
}

func TestTracerManager(t *testing.T) {
	tm := NewTracerManager("test-service")
	if tm.Tracer() == nil {
		t.Error("tracer should not be nil")
	}

	ctx := context.Background()
	spCtx := tm.NewSpan(ctx, "test.operation")
	spCtx.End(nil)
}

func TestApplySpanOpts(t *testing.T) {
	opts := []spanOptions{
		withKind(oteltrace.SpanKindClient),
		withAttrs(attribute.String("a", "1"), attribute.String("b", "2")),
		withTags(map[string]string{"x": "y"}),
	}

	result := applySpanOpts(opts)
	if result.kind != oteltrace.SpanKindClient {
		t.Errorf("kind = %v, want %v", result.kind, oteltrace.SpanKindClient)
	}
	if len(result.attrs) != 2 {
		t.Errorf("attrs len = %d, want 2", len(result.attrs))
	}
	if result.tags["x"] != "y" {
		t.Errorf("tags[x] = %q, want %q", result.tags["x"], "y")
	}
}

func TestApplySpanOptsLastWins(t *testing.T) {
	opts := []spanOptions{
		withKind(oteltrace.SpanKindClient),
		withKind(oteltrace.SpanKindServer),
	}

	result := applySpanOpts(opts)
	if result.kind != oteltrace.SpanKindServer {
		t.Errorf("kind = %v, want Server", result.kind)
	}
}
