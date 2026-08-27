// Package otel provides Span utility functions for service-layer tracing.
//
// Usage:
//
//	func (s *Service) Create(ctx context.Context, req *CreateReq) (*Model, error) {
//	    ctx, span := otel.StartSpan(ctx, "circuit-breaker.Create",
//	        otel.AttrString("breaker.name", req.Name))
//	    defer span.End()
//	    if err := s.validate(req); err != nil {
//	        span.RecordError(err)
//	        span.SetStatus(codes.Error, "validation failed")
//	        return nil, err
//	    }
//	    return s.repository.Create(ctx, req)
//	}
package otel

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// StartSpan creates a span and returns the context with the span active.
// The span must be ended by calling span.End().
func StartSpan(ctx context.Context, name string, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	tracer := otel.Tracer("orion/platform-svc")
	return tracer.Start(ctx, name, trace.WithAttributes(attrs...))
}

// StartSpanFromContext is an alias for StartSpan for ergonomic imports.
func StartSpanFromContext(ctx context.Context, name string, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	return StartSpan(ctx, name, attrs...)
}

// SetSpanError marks a span as error and records the error.
func SetSpanError(span trace.Span, err error) {
	span.RecordError(err)
	span.SetStatus(codes.Error, err.Error())
}

// SetSpanAttr adds attributes to an active span.
func SetSpanAttr(span trace.Span, kv ...attribute.KeyValue) {
	span.SetAttributes(kv...)
}

// AttrString creates an attribute.String key-value pair.
func AttrString(k string, v string) attribute.KeyValue {
	return attribute.String(k, v)
}

// AttrInt creates an attribute.Int64 key-value pair.
func AttrInt(k string, v int) attribute.KeyValue {
	return attribute.Int64(k, int64(v))
}

// AttrBool creates an attribute.Bool key-value pair.
func AttrBool(k string, v bool) attribute.KeyValue {
	return attribute.Bool(k, v)
}

// AttrStringSlice creates an attribute.StringSlice key-value pair.
func AttrStringSlice(k string, v []string) attribute.KeyValue {
	return attribute.StringSlice(k, v)
}

// ExtractTraceID extracts the trace ID from a context as a hex string.
func ExtractTraceID(ctx context.Context) string {
	span := trace.SpanFromContext(ctx)
	if span == nil {
		return ""
	}
	tid := span.SpanContext().TraceID()
	if tid == (trace.TraceID{}) {
		return ""
	}
	return tid.String()
}

// ExtractSpanID extracts the span ID from a context as a hex string.
func ExtractSpanID(ctx context.Context) string {
	span := trace.SpanFromContext(ctx)
	if span == nil {
		return ""
	}
	sid := span.SpanContext().SpanID()
	if sid == (trace.SpanID{}) {
		return ""
	}
	return sid.String()
}
