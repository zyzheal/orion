package otel

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.uber.org/zap"
)

// InitTracer initializes the OpenTelemetry tracer with OTLP gRPC exporter.
func InitTracer(ctx context.Context, endpoint, serviceName, serviceVersion string, log *zap.Logger) (*sdktrace.TracerProvider, error) {
	exporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithInsecure(),
		otlptracegrpc.WithEndpoint(endpoint),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTLP exporter: %w", err)
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			semconv.ServiceVersion(serviceVersion),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter,
			sdktrace.WithBatchTimeout(5*time.Second),
			sdktrace.WithMaxExportBatchSize(100),
		),
		sdktrace.WithResource(res),
	)

	otel.SetTracerProvider(tp)

	log.Info("OpenTelemetry tracer initialized",
		zap.String("endpoint", endpoint),
		zap.String("serviceName", serviceName),
	)

	return tp, nil
}

// Shutdown gracefully shuts down the tracer provider.
func Shutdown(ctx context.Context, tp *sdktrace.TracerProvider, log *zap.Logger) error {
	if tp == nil {
		return nil
	}
	if err := tp.Shutdown(ctx); err != nil {
		log.Error("failed to shutdown tracer provider", zap.Error(err))
		return err
	}
	log.Info("OpenTelemetry tracer shutdown complete")
	return nil
}
