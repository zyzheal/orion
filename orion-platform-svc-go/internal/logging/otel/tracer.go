package otel

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	oteltrace "go.opentelemetry.io/otel/trace"
)

// TracerProviderConfig holds options specific to the TracerProvider.
type TracerProviderConfig struct {
	// ServiceName is used as the resource service.name attribute.
	ServiceName string
	// OTLPEndpoint is the OTLP gRPC collector address.
	OTLPEndpoint string
	// Insecure disables TLS for the OTLP connection.
	Insecure bool
	// SampleRate controls head-based sampling (0.0–1.0).
	SampleRate float64
}

// InitTracerProvider creates a TracerProvider backed by an OTLP gRPC exporter.
// If endpoint is empty, a no-op provider is returned (graceful fallback).
//
// The caller is responsible for calling the returned Shutdown function (e.g.
// via defer) to flush pending spans before process exit.
func InitTracerProvider(ctx context.Context, cfg TracerProviderConfig) (ShutdownFunc, error) {
	if cfg.OTLPEndpoint == "" {
		otelLogf("otel trace: no endpoint configured, using no-op provider")
		return nil, nil
	}

	exp, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint(cfg.OTLPEndpoint),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		return nil, fmt.Errorf("otel trace: create OTLP exporter: %w", err)
	}

	// Parent-based + head-based probability sampler.
	sampler := sdktrace.ParentBased(sdktrace.TraceIDRatioBased(cfg.SampleRate))

	provider := sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sampler),
		sdktrace.WithBatcher(exp),
	)

	// Set as global so otel.Tracer(name) resolves to a real provider.
	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(
		propagation.NewCompositeTextMapPropagator(
			propagation.TraceContext{},
			propagation.Baggage{},
		),
	)

	otelLogf("otel trace: TracerProvider initialized (endpoint=%s, sample_rate=%v)",
		cfg.OTLPEndpoint, cfg.SampleRate)

	return func() {
		_ = provider.Shutdown(ctx)
	}, nil
}

// GlobalTracer returns the globally registered tracer named serviceName.
// When no TracerProvider is configured this returns an oteltrace.NoopTracer.
func GlobalTracer(serviceName string) oteltrace.Tracer {
	return otel.Tracer(serviceName)
}
