package otel

import (
	"os"
	"strconv"
	"time"
)

// Config holds OTel initialization parameters read from environment variables.
type Config struct {
	// ServiceName identifies the service in OTel exports.
	// Env: OTEL_SERVICE_NAME, default: "orion-platform"
	ServiceName string

	// OTLPEndpoint is the OTLP gRPC collector address.
	// Env: OTEL_EXPORTER_OTLP_ENDPOINT, default: "localhost:4317"
	OTLPEndpoint string

	// Insecure disables TLS for the OTLP gRPC connection (dev-only).
	// Env: OTEL_INSECURE, default: "true"
	Insecure bool

	// TracesSampleRate controls head-based sampling (0.0 = none, 1.0 = all).
	// Env: OTEL_TRACES_SAMPLE_RATE, default: "1.0"
	TracesSampleRate float64

	// TraceExportInterval is how often completed spans are flushed.
	// Env: OTEL_TRACE_EXPORT_INTERVAL, default: "5s"
	TraceExportInterval time.Duration

	// MetricExportInterval is how often metrics are flushed.
	// Env: OTEL_METRIC_EXPORT_INTERVAL, default: "15s"
	MetricExportInterval time.Duration

	// Disabled forces no-op providers regardless of other settings.
	// Env: OTEL_DISABLED, default: "false"
	Disabled bool
}

// DefaultConfig returns a Config populated from environment variables with
// sensible defaults. The resulting Config is always valid; missing/invalid
// env values fall back to defaults.
func DefaultConfig() Config {
	cfg := Config{
		ServiceName:          "orion-platform",
		OTLPEndpoint:         "localhost:4317",
		Insecure:             true,
		TracesSampleRate:     1.0,
		TraceExportInterval:  5 * time.Second,
		MetricExportInterval: 15 * time.Second,
	}

	if v := os.Getenv("OTEL_SERVICE_NAME"); v != "" {
		cfg.ServiceName = v
	}
	if v := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"); v != "" {
		cfg.OTLPEndpoint = v
	}
	if v := os.Getenv("OTEL_INSECURE"); v != "" {
		cfg.Insecure = v == "true" || v == "1"
	}
	if v := os.Getenv("OTEL_TRACES_SAMPLE_RATE"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			cfg.TracesSampleRate = f
		}
	}
	if v := os.Getenv("OTEL_TRACE_EXPORT_INTERVAL"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.TraceExportInterval = d
		}
	}
	if v := os.Getenv("OTEL_METRIC_EXPORT_INTERVAL"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.MetricExportInterval = d
		}
	}
	if v := os.Getenv("OTEL_DISABLED"); v != "" {
		cfg.Disabled = v == "true" || v == "1"
	}

	return cfg
}
