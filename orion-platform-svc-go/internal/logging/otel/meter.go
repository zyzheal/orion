package otel

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	otelmetric "go.opentelemetry.io/otel/metric"
)

// MeterProviderConfig holds options specific to the MeterProvider.
type MeterProviderConfig struct {
	// OTLPEndpoint is the OTLP gRPC collector address.
	OTLPEndpoint string
	// ExportInterval controls how often metrics are flushed.
	ExportInterval time.Duration
}

// InitMeterProvider creates a MeterProvider backed by an OTLP gRPC exporter.
// If endpoint is empty, a no-op provider is returned (graceful fallback).
//
// The caller is responsible for calling the returned Shutdown function (e.g.
// via defer) to flush pending metrics before process exit.
func InitMeterProvider(ctx context.Context, cfg MeterProviderConfig) (ShutdownFunc, error) {
	if cfg.OTLPEndpoint == "" {
		otelLogf("otel metric: no endpoint configured, using no-op provider")
		return nil, nil
	}

	exp, err := otlpmetricgrpc.New(ctx,
		otlpmetricgrpc.WithEndpoint(cfg.OTLPEndpoint),
		otlpmetricgrpc.WithInsecure(),
	)
	if err != nil {
		return nil, fmt.Errorf("otel metric: create OTLP exporter: %w", err)
	}

	interval := cfg.ExportInterval
	if interval <= 0 {
		interval = 15 * time.Second
	}

	provider := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(
			sdkmetric.NewPeriodicReader(exp,
				sdkmetric.WithInterval(interval),
			),
		),
	)

	otel.SetMeterProvider(provider)

	otelLogf("otel metric: MeterProvider initialized (endpoint=%s)", cfg.OTLPEndpoint)

	return func() {
		_ = provider.Shutdown(ctx)
	}, nil
}

// GlobalMeter returns the globally registered meter named name.
// When no MeterProvider is configured this returns an otelmetric.NoopMeter.
func GlobalMeter(name string) otelmetric.Meter {
	return otel.Meter(name)
}
