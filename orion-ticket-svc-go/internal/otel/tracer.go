package otel

import (
	"context"

	"orion-ticket-svc-go/internal/config"

	otelapi "go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

func InitTracer(ctx context.Context, cfg *config.OtelConfig, logger *zap.Logger) (func(), error) {
	if !cfg.Enabled {
		// Use no-op tracer
		otelapi.SetTracerProvider(sdktrace.NewTracerProvider())
		return func() {}, nil
	}

	opts := []otlptracehttp.Option{
		otlptracehttp.WithEndpoint(cfg.Endpoint),
	}

	exporter, err := otlptracehttp.New(ctx, opts...)
	if err != nil {
		return nil, err
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			attribute.String("service.name", cfg.ServiceName),
		),
	)
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)
	otelapi.SetTracerProvider(tp)
	logger.Info("OpenTelemetry tracer initialized", zap.String("endpoint", cfg.Endpoint), zap.String("service", cfg.ServiceName))

	return func() {
		_ = tp.Shutdown(context.Background())
	}, nil
}

func Tracer() trace.Tracer {
	return otelapi.Tracer("orion-ticket-svc")
}
