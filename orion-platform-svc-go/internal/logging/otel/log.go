package otel

import "log"

// otelLogf is a shared debug logger used by InitTracerProvider and
// InitMeterProvider when they fall back to no-op mode.
func otelLogf(format string, args ...interface{}) {
	log.Printf(format, args...)
}
