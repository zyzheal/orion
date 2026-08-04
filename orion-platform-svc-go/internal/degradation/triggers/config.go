package triggers

import (
	"errors"
	"time"
)

var (
	ErrInvalidErrorRateThreshold  = errors.New("error rate threshold must be in [0.0, 1.0]")
	ErrInvalidLatencyThreshold    = errors.New("latency threshold must be positive milliseconds")
	ErrInvalidWindowSize          = errors.New("window size must be >= 2")
	ErrInvalidMinSampleCount      = errors.New("minimum sample count must be >= 1")
	ErrInvalidHysteresisConfig    = errors.New("hysteresis config has invalid values")
)

// TriggerConfig holds the configuration for an automatic degradation trigger.
// It mirrors Prometheus-style metric evaluation: a sliding window of recent
// metric snapshots is examined; if either the error rate or the P99 latency
// exceed their respective thresholds, the trigger fires.  Recovery requires
// a consecutive streak of healthy evaluations plus a hysteresis margin to
// prevent flapping (oscillation between DEGRADED and NORMAL).
type TriggerConfig struct {
	// ErrorRateThreshold is the fraction of failed requests that triggers
	// degradation.  Typical values: 0.05 (5%), 0.10 (10%).
	ErrorRateThreshold float64 `json:"errorRateThreshold"`

	// LatencyThresholdMs is the P99 latency in milliseconds above which
	// degradation is triggered.  Typical values: 500, 1000.
	LatencyThresholdMs int64 `json:"latencyThresholdMs"`

	// WindowSize is the number of MetricSnapshots kept in the sliding
	// window for trend evaluation.
	WindowSize int `json:"windowSize"`

	// MinSampleCount is the minimum number of samples inside a single
	// MetricSnapshot needed before the snapshot is considered valid for
	// evaluation.
	MinSampleCount int `json:"minSampleCount"`

	// EvaluateInterval is how often the trigger re-evaluates the window.
	// Used when the trigger runs as a background goroutine.
	EvaluateInterval time.Duration `json:"evaluateInterval,omitempty"`

	// Hysteresis controls recovery behaviour to prevent flapping.
	Hysteresis HysteresisConfig `json:"hysteresis"`

	// CircuitBreakerRef links the trigger to a circuit-breaker so that
	// a firing can OPEN the circuit and recovery can move it to HALF_OPEN.
	CircuitBreakerRef string `json:"circuitBreakerRef"`
}

// HysteresisConfig defines the recovery margin.
type HysteresisConfig struct {
	// Enabled turns hysteresis on.  When disabled, a single healthy
	// evaluation will immediately recover from DEGRADED.
	Enabled bool `json:"enabled"`

	// RecoverErrorRateMargin is the *additional* amount by which the
	// current error rate must be BELOW the threshold before recovery is
	// considered.  E.g. threshold=0.10, margin=0.02 → recover only when
	// error_rate < 0.08.
	RecoverErrorRateMargin float64 `json:"recoverErrorRateMargin"`

	// RecoverLatencyMarginMs is the *additional* margin (in ms) that P99
	// latency must be below the threshold for recovery.
	RecoverLatencyMarginMs int64 `json:"recoverLatencyMarginMs"`

	// HealthStreakRequired is the number of consecutive healthy
	// evaluations needed before the trigger recovers from DEGRADED.
	// Set to 1 to recover on the first healthy evaluation.
	HealthStreakRequired int `json:"healthStreakRequired"`
}

// DefaultTriggerConfig returns a sensible default configuration.
func DefaultTriggerConfig() TriggerConfig {
	return TriggerConfig{
		ErrorRateThreshold:  0.05,
		LatencyThresholdMs:  500,
		WindowSize:          10,
		MinSampleCount:      10,
		EvaluateInterval:    10 * time.Second,
		Hysteresis: HysteresisConfig{
			Enabled:               true,
			RecoverErrorRateMargin: 0.02,
			RecoverLatencyMarginMs: 100,
			HealthStreakRequired:   3,
		},
		CircuitBreakerRef: "",
	}
}

// Validate checks the configuration for obvious errors.
func (c TriggerConfig) Validate() error {
	if c.ErrorRateThreshold < 0.0 || c.ErrorRateThreshold > 1.0 {
		return ErrInvalidErrorRateThreshold
	}
	if c.LatencyThresholdMs <= 0 {
		return ErrInvalidLatencyThreshold
	}
	if c.WindowSize < 2 {
		return ErrInvalidWindowSize
	}
	if c.MinSampleCount < 1 {
		return ErrInvalidMinSampleCount
	}
	if c.Hysteresis.RecoverErrorRateMargin < 0.0 {
		return ErrInvalidHysteresisConfig
	}
	if c.Hysteresis.RecoverLatencyMarginMs < 0 {
		return ErrInvalidHysteresisConfig
	}
	if c.Hysteresis.HealthStreakRequired < 1 {
		return ErrInvalidHysteresisConfig
	}
	return nil
}

// RecoverErrorRate returns the effective error-rate target for recovery
// (threshold minus margin), floored at 0.0.
func (c TriggerConfig) RecoverErrorRate() float64 {
	r := c.ErrorRateThreshold - c.Hysteresis.RecoverErrorRateMargin
	if r < 0.0 {
		return 0.0
	}
	return r
}

// RecoverLatencyMs returns the effective P99-latency target for recovery
// (threshold minus margin), floored at 1.
func (c TriggerConfig) RecoverLatencyMs() int64 {
	r := c.LatencyThresholdMs - c.Hysteresis.RecoverLatencyMarginMs
	if r < 1 {
		return 1
	}
	return r
}
