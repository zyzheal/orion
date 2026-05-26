package otel

import (
	"context"

	"orion-cmdb-svc-go/internal/config"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

func InitTracer(ctx context.Context, cfg *config.OtelConfig, logger *zap.Logger) (func(), error) {
	if !cfg.Enabled {
		otel.SetTracerProvider(sdktrace.NewTracerProvider())
		return func() {}, nil
	}

	exporter, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpoint(cfg.Endpoint),
		otlptracehttp.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}

	res, err := resource.New(ctx, resource.WithAttributes())
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	logger.Info("OpenTelemetry tracer initialized", zap.String("endpoint", cfg.Endpoint))

	return func() {
		_ = tp.Shutdown(context.Background())
	}, nil
}

func Tracer() trace.Tracer {
	return otel.Tracer("orion-cmdb-svc")
}
