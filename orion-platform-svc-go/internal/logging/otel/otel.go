// Package otel provides OpenTelemetry SDK initialization (Traces + Metrics)
// for orion-platform-svc-go.
//
// OTel is additive: it does NOT replace the existing zap logging pipeline.
// Use Init() at process startup and call the returned Shutdown function on
// graceful shutdown.
//
// Environment variables (all optional):
//   OTEL_SERVICE_NAME           service identifier (default: orion-platform)
//   OTEL_EXPORTER_OTLP_ENDPOINT OTLP gRPC endpoint (default: localhost:4317)
//   OTEL_TRACES_SAMPLE_RATE     head-based trace sampling, 0.0-1.0 (default: 1.0)
//   OTEL_TRACE_EXPORT_INTERVAL  span flush interval (default: 5s)
//   OTEL_METRIC_EXPORT_INTERVAL metric flush interval (default: 15s)
//   OTEL_INSECURE               disable TLS for OTLP (default: true)
//   OTEL_DISABLED               force no-op providers (default: false)
//
// If OTEL_EXPORTER_OTLP_ENDPOINT is unset, all providers are no-op and the
// application runs with zero OTel overhead.
package otel

import (
	"context"
	"fmt"
	"os"

	otelglobal "go.opentelemetry.io/otel"
	oteltrace "go.opentelemetry.io/otel/trace"
	otelmetric "go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/propagation"
)

// ShutdownFunc is the cleanup function returned by Init. Call it on graceful
// shutdown to flush pending spans and metrics.
type ShutdownFunc func()

// Tracer is an alias for the OTel trace.Tracer interface.
type Tracer = oteltrace.Tracer

// Meter is an alias for the OTel metric.Meter interface.
type Meter = otelmetric.Meter

// Init initializes the OTel SDK pillars (Traces + Metrics) using
// environment-variable configuration. Each pillar falls back to a no-op
// provider if its exporter fails to start, so the application continues
// running unmodified.
//
// Usage:
//
//	cfg := otel.DefaultConfig()
//	shutdown, err := otel.Init(ctx, cfg)
//	if err != nil {
//	    log.Printf("otel init: %v", err)
//	}
//	defer shutdown()
func Init(ctx context.Context, cfg Config) (ShutdownFunc, error) {
	if cfg.Disabled {
		return func() {}, nil
	}

	shutoffs := make([]func(), 0, 2)

	// TracerProvider.
	tpShutdown, tpErr := newTracerProvider(ctx, cfg)
	if tpErr != nil {
		return nil, fmt.Errorf("otel: init tracer provider: %w", tpErr)
	}
	if tpShutdown != nil {
		shutoffs = append(shutoffs, tpShutdown)
	}

	// MeterProvider.
	mpShutdown, mpErr := newMeterProvider(ctx, cfg)
	if mpErr != nil {
		return nil, fmt.Errorf("otel: init meter provider: %w", mpErr)
	}
	if mpShutdown != nil {
		shutoffs = append(shutoffs, mpShutdown)
	}

	info := &initInfo{traces: tpShutdown != nil, metrics: mpShutdown != nil}

	return func() {
		for i := len(shutoffs) - 1; i >= 0; i-- {
			shutoffs[i]()
		}
	}, info.error()
}

// Tracer returns the globally registered tracer named name.
// When no TracerProvider is configured this returns an OTel NoopTracer.
func TracerProvider(name string) Tracer {
	return otelglobal.Tracer(name)
}

// Meter returns the globally registered meter named name.
// When no MeterProvider is configured this returns an OTel NoopMeter.
func MeterProvider(name string) Meter {
	return otelglobal.Meter(name)
}

// Propagator returns the globally registered text map propagator.
// When none is configured this returns the default (W3C TraceContext + Baggage).
func Propagator() propagation.TextMapPropagator {
	return otelglobal.GetTextMapPropagator()
}

// isSet returns the value of an environment variable, empty string if unset.
func isSet(key string) string {
	return os.Getenv(key)
}

type initInfo struct {
	traces  bool
	metrics bool
}

func (i *initInfo) error() error {
	if i.traces || i.metrics {
		return nil
	}
	return fmt.Errorf("otel: no pillars enabled (OTLP endpoint unset or all exporters failed)")
}
