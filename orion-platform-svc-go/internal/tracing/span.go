package tracing

import (
	"context"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
)

const (
	SpanDB       = "db"
	SpanRedis    = "redis"
	SpanHTTP     = "http"
	SpanMessage  = "message"
	SpanGraphQL  = "graphql"
	SpanRPC      = "rpc"
	SpanCache    = "cache"
	SpanAuth     = "auth"
	SpanBusiness = "business"
)

type spanOptions struct {
	kind  oteltrace.SpanKind
	attrs []attribute.KeyValue
	tags  map[string]string
	time  time.Time
}

func applySpanOpts(opts []spanOptions) spanOptions {
	var merged spanOptions
	for _, o := range opts {
		if o.kind != 0 {
			merged.kind = o.kind
		}
		merged.attrs = append(merged.attrs, o.attrs...)
		if o.tags != nil {
			if merged.tags == nil {
				merged.tags = make(map[string]string)
			}
			for k, v := range o.tags {
				merged.tags[k] = v
			}
		}
		if !o.time.IsZero() {
			merged.time = o.time
		}
	}
	if merged.kind == 0 {
		merged.kind = oteltrace.SpanKindInternal
	}
	return merged
}

func withKind(kind oteltrace.SpanKind) spanOptions {
	return spanOptions{kind: kind}
}

func withAttrs(attrs ...attribute.KeyValue) spanOptions {
	return spanOptions{attrs: attrs}
}

func withTags(tags map[string]string) spanOptions {
	return spanOptions{tags: tags}
}

type SpanContext struct {
	Ctx  context.Context
	Span oteltrace.Span
	End  func(err error)
}

func StartSpan(ctx context.Context, tracer oteltrace.Tracer, name string, opts ...spanOptions) SpanContext {
	cfg := applySpanOpts(opts)

	attrs := make([]attribute.KeyValue, 0, len(cfg.attrs)+len(cfg.tags))
	attrs = append(attrs, cfg.attrs...)
	for k, v := range cfg.tags {
		attrs = append(attrs, attribute.String(k, v))
	}

	var span oteltrace.Span
	if cfg.time.IsZero() {
		ctx, span = tracer.Start(ctx, name,
			oteltrace.WithSpanKind(cfg.kind),
			oteltrace.WithAttributes(attrs...),
		)
	} else {
		ctx, span = tracer.Start(ctx, name,
			oteltrace.WithSpanKind(cfg.kind),
			oteltrace.WithAttributes(attrs...),
			oteltrace.WithTimestamp(cfg.time),
		)
	}

	return SpanContext{
		Ctx:  ctx,
		Span: span,
		End: func(err error) {
			if err != nil {
				span.RecordError(err)
				span.SetStatus(codes.Error, err.Error())
			}
			span.End()
		},
	}
}

func SpanFromContext(ctx context.Context) (oteltrace.Span, bool) {
	span := oteltrace.SpanFromContext(ctx)
	ctx2 := span.SpanContext()
	return span, ctx2.IsValid()
}
