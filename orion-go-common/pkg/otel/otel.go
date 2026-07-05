// Package otel provides shared OpenTelemetry initialization for Orion Go services.
//
// Replaces per-service duplicated otel.Init() functions.
package otel

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
	"go.opentelemetry.io/otel/trace"
)

// Config holds OpenTelemetry configuration.
type Config struct {
	// ServiceName is the name reported to the OTel collector.
	ServiceName string
	// Endpoint is the OTel collector endpoint (e.g., "localhost:4318").
	// If empty, tracing is disabled.
	Endpoint string
	// Insecure disables TLS for the OTel connection. Default: true (for local dev).
	Insecure bool
}

// Init initializes OpenTelemetry tracing.
// Returns a shutdown function that should be deferred in main().
// If Endpoint is empty, returns a no-op shutdown function and nil error.
func Init(cfg Config) (shutdown func(context.Context) error, err error) {
	if cfg.Endpoint == "" {
		return func(context.Context) error { return nil }, nil
	}

	ctx := context.Background()

	opts := []otlptracehttp.Option{
		otlptracehttp.WithEndpoint(cfg.Endpoint),
	}
	if cfg.Insecure {
		opts = append(opts, otlptracehttp.WithInsecure())
	}

	exporter, err := otlptracehttp.New(ctx, opts...)
	if err != nil {
		return nil, err
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(semconv.ServiceName(cfg.ServiceName)),
	)
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)

	return tp.Shutdown, nil
}

// Tracer returns a tracer for the given name.
// Use this to create spans in your service code.
func Tracer(name string) trace.Tracer {
	return otel.Tracer(name)
}
