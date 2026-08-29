package tracing

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
)

const msgSpanPrefix = "message."

type MessageSpan struct {
	ctx       context.Context
	span      oteltrace.Span
	operation string
	topic     string
}

func NewMessageSpan(ctx context.Context, tracer oteltrace.Tracer, operation, topic string) MessageSpan {
	name := fmt.Sprintf("%s%s", msgSpanPrefix, operation)
	name = strings.ToLower(name)

	attrs := []attribute.KeyValue{
		attribute.String("messaging.system", "nats"),
		attribute.String("messaging.destination", topic),
		attribute.String("messaging.operation", operation),
	}

	spCtx := StartSpan(ctx, tracer, name,
		withKind(oteltrace.SpanKindProducer),
		withAttrs(attrs...),
	)

	return MessageSpan{ctx: spCtx.Ctx, span: spCtx.Span, operation: operation, topic: topic}
}

func (m MessageSpan) Publish(data []byte) error {
	start := time.Now()
	m.span.SetAttributes(attribute.Int("messaging.message.size", len(data)))
	elapsed := time.Since(start)
	m.span.SetAttributes(attribute.Int64("messaging.duration.ms", int64(elapsed.Milliseconds())))
	m.span.End()
	return nil
}

func (m MessageSpan) Consume(data []byte, handler func(context.Context, []byte) error) error {
	m.span.SetAttributes(attribute.Int("messaging.message.size", len(data)))
	start := time.Now()

	err := handler(m.ctx, data)
	elapsed := time.Since(start)
	m.span.SetAttributes(attribute.Int64("messaging.duration.ms", int64(elapsed.Milliseconds())))

	if err != nil {
		m.span.RecordError(err)
		m.span.SetStatus(codes.Error, "message handler error")
	}
	m.span.End()
	return err
}

func (m MessageSpan) End(err error) {
	if err != nil {
		m.span.RecordError(err)
		m.span.SetStatus(codes.Error, "message error")
	}
	m.span.End()
}
