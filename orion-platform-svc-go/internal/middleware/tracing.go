// Package middleware provides Orion-platform-specific Gin middleware.
package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	otelstd "go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

// traceHeader is the canonical header name used for cross-service trace IDs.
const traceHeader = "X-Trace-ID"

// ginTraceKey is the key used to store the trace ID in gin context.
const ginTraceKey = "trace_id"

// TracingConfig holds configuration for the tracing middleware.
type TracingConfig struct {
	// ServiceName is reported in span attributes.
	ServiceName string
}

// Tracing returns a Gin middleware that:
//  1. Extracts or generates a trace ID (priority: X-Trace-ID header, then new UUID).
//  2. Injects it into gin context via c.Set("trace_id", id).
//  3. Creates an OTel span for the request (no-op if OTel not configured).
//  4. Propagates the trace ID to the response header.
//  5. Attaches the trace ID to the request context for downstream use.
func Tracing(cfg TracingConfig) gin.HandlerFunc {
	tracer := otel.Tracer(cfg.ServiceName)
	propagator := otelstd.GetTextMapPropagator()

	return func(c *gin.Context) {
		// Step 1: Extract existing trace context from incoming headers.
		ctx := propagator.Extract(c.Request.Context(), propagation.HeaderCarrier(c.Request.Header))

		// Step 2: Determine trace ID — prefer propagated span, otherwise generate.
		spanCtx := trace.SpanContextFromContext(ctx)
		var traceID string
		if spanCtx.IsValid() {
			traceID = spanCtx.TraceID().String()
		} else {
			// Fallback: check the raw X-Trace-ID header (cross-service convention).
			if raw := c.GetHeader(traceHeader); raw != "" {
				traceID = raw
			} else {
				traceID = generateTraceID()
			}
		}

		// Step 3: Build a new context carrying the trace ID explicitly.
		// Use the propagated context if it's valid, otherwise attach a root span.
		if spanCtx.IsValid() {
			ctx = trace.ContextWithSpanContext(ctx, spanCtx)
		} else {
			// Create a non-recording root span so downstream code can read trace_id
			// from the context, even if the global tracer provider is a no-op.
			_, span := tracer.Start(ctx, traceID, trace.WithSpanKind(trace.SpanKindServer))
			defer span.End()
		}

		// Step 4: Create request span.
		reqCtx := c.Request.WithContext(ctx)
		c.Request = reqCtx

		spanName := c.Request.Method + " " + c.Request.URL.Path
		_, reqSpan := tracer.Start(ctx, spanName,
			trace.WithAttributes(
				attribute.String("service.name", cfg.ServiceName),
				attribute.String("http.method", c.Request.Method),
				attribute.String("http.route", c.Request.URL.Path),
			),
		)

		// Step 5: Inject into gin context for handler access.
		c.Set(ginTraceKey, traceID)

		// Step 6: Set trace ID on the span.
		reqSpan.SetAttributes(attribute.String("trace.id", traceID))

		defer reqSpan.End()

		// Step 7: Execute handler chain.
		c.Next()

		// Step 8: Inject response header (always, even for errors).
		c.Header(traceHeader, traceID)

		// Step 9: Attach HTTP status to span.
		reqSpan.SetAttributes(attribute.Int("http.status_code", c.Writer.Status()))
	}
}

// GetTraceID extracts the trace ID from the gin context.
func GetTraceID(c *gin.Context) string {
	v, _ := c.Get(ginTraceKey)
	s, _ := v.(string)
	return s
}

// TraceContext returns a context with the trace ID attached, suitable for
// passing to service/repository layers that accept context.Context.
func TraceContext(c *gin.Context) context.Context {
	return trace.ContextWithSpanContext(
		c.Request.Context(),
		trace.SpanContextFromContext(c.Request.Context()),
	)
}

// WithTraceID returns a context.Context carrying the given trace ID as a span context.
// Useful for background goroutines that need to propagate the trace.
func WithTraceID(ctx context.Context, id string) context.Context {
	// Parse the trace ID back into a SpanContext for OTel propagation.
	tid, err := trace.TraceIDFromHex(id)
	if err != nil {
		return ctx
	}
	sid, err := trace.SpanIDFromHex(generateTraceID()[:16])
	if err != nil {
		return ctx
	}
	sc := trace.NewSpanContext(trace.SpanContextConfig{
		TraceID:    tid,
		SpanID:     sid,
		TraceFlags: trace.FlagsSampled,
	})
	return trace.ContextWithSpanContext(ctx, sc)
}

// generateTraceID returns a 32-hex-digit UUID (no hyphens).
func generateTraceID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
