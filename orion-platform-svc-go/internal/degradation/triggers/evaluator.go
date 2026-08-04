package triggers

import (
	"fmt"
	"time"

	"go.uber.org/zap"
)

// Decision represents the outcome of an evaluation cycle.
type Decision struct {
	Trigger           bool      `json:"trigger"`
	Recover           bool      `json:"recover"`
	ErrorRate         float64   `json:"errorRate"`
	LatencyP99Ms      int64     `json:"latencyP99Ms"`
	ErrorRateLimit    float64   `json:"errorRateLimit"`
	LatencyP99LimitMs int64     `json:"latencyP99LimitMs"`
	HealthStreak      int       `json:"healthStreak"`
	Reason            string    `json:"reason"`
	EvaluatedAt       time.Time `json:"evaluatedAt"`
}

// Evaluator evaluates a MetricSnapshot (or aggregated window metrics)
// against the configured thresholds and returns a Decision.
type Evaluator struct {
	cfg  *TriggerConfig
	log  *zap.Logger
	once func() // initialised lazily if a logger was not provided
}

// NewEvaluator creates an evaluator for the given config.
func NewEvaluator(cfg TriggerConfig, log *zap.Logger) *Evaluator {
	return &Evaluator{
		cfg: &cfg,
		log: log,
	}
}

// EvaluateSnapshot evaluates a single snapshot against the thresholds.
func (e *Evaluator) EvaluateSnapshot(s MetricSnapshot) Decision {
	agg := AggregatedMetrics{
		ErrorCount:     s.ErrorCount,
		TotalCount:     s.TotalCount,
		ErrorRate:      s.ErrorRate(),
		LatencySamples: s.LatencySamples,
	}
	agg.Compute()
	return e.evaluateAggregate(agg)
}

// EvaluateAggregated evaluates aggregated metrics (typically from the
// sliding window) against the thresholds.
func (e *Evaluator) EvaluateAggregated(agg AggregatedMetrics) Decision {
	agg.Compute()
	return e.evaluateAggregate(agg)
}

func (e *Evaluator) evaluateAggregate(agg AggregatedMetrics) Decision {
	d := Decision{
		EvaluatedAt:       time.Now().UTC(),
		ErrorRate:         agg.ErrorRate,
		LatencyP99Ms:      agg.P99LatencyMs,
		ErrorRateLimit:    e.cfg.ErrorRateThreshold,
		LatencyP99LimitMs: e.cfg.LatencyThresholdMs,
	}

	// Zero-traffic guard: not enough data to make a decision.
	if agg.TotalCount < e.cfg.MinSampleCount {
		d.Reason = fmt.Sprintf("insufficient traffic (samples=%d, min=%d)", agg.TotalCount, e.cfg.MinSampleCount)
		return d
	}

	errorBreach := agg.ErrorRate > e.cfg.ErrorRateThreshold
	latencyBreach := agg.P99LatencyMs > e.cfg.LatencyThresholdMs

	if errorBreach || latencyBreach {
		d.Trigger = true
		var reasons []string
		if errorBreach {
			reasons = append(reasons, fmt.Sprintf("error_rate=%.4f > %.4f", agg.ErrorRate, e.cfg.ErrorRateThreshold))
		}
		if latencyBreach {
			reasons = append(reasons, fmt.Sprintf("latency_p99=%dms > %dms", agg.P99LatencyMs, e.cfg.LatencyThresholdMs))
		}
		d.Reason = fmt.Sprintf("threshold breach: %s", joinReasons(reasons))
		if e.log != nil {
			e.log.Warn("evaluator: trigger threshold breach",
				zap.Float64("errorRate", agg.ErrorRate),
				zap.Int64("latencyP99Ms", agg.P99LatencyMs),
				zap.String("reason", d.Reason))
		}
		return d
	}

	// Healthy — not tripping thresholds.
	d.Reason = "within normal thresholds"
	if e.log != nil {
		e.log.Debug("evaluator: healthy",
			zap.Float64("errorRate", agg.ErrorRate),
			zap.Int64("latencyP99Ms", agg.P99LatencyMs))
	}
	return d
}

// EvaluateRecoverySnapshot checks whether a degraded system may recover
// based on the latest snapshot.  It applies the hysteresis margin and returns
// true only when the metrics are strictly below the threshold minus the
// configured margin.
func (e *Evaluator) EvaluateRecoverySnapshot(s MetricSnapshot) Decision {
	agg := AggregatedMetrics{
		ErrorCount:     s.ErrorCount,
		TotalCount:     s.TotalCount,
		ErrorRate:      s.ErrorRate(),
		LatencySamples: s.LatencySamples,
	}
	agg.Compute()

	d := Decision{
		EvaluatedAt:       time.Now().UTC(),
		ErrorRate:         agg.ErrorRate,
		LatencyP99Ms:      agg.P99LatencyMs,
		ErrorRateLimit:    e.cfg.RecoverErrorRate(),
		LatencyP99LimitMs: e.cfg.RecoverLatencyMs(),
	}

	if agg.TotalCount < e.cfg.MinSampleCount {
		d.Reason = fmt.Sprintf("insufficient traffic (samples=%d, min=%d)", agg.TotalCount, e.cfg.MinSampleCount)
		return d
	}

	recoverError := agg.ErrorRate < e.cfg.RecoverErrorRate()
	recoverLatency := agg.P99LatencyMs < e.cfg.RecoverLatencyMs()

	if e.cfg.Hysteresis.Enabled {
		if recoverError && recoverLatency {
			d.Recover = true
			d.Reason = fmt.Sprintf("hysteresis: error_rate=%.4f < %.4f, latency_p99=%dms < %dms",
				agg.ErrorRate, e.cfg.RecoverErrorRate(), agg.P99LatencyMs, e.cfg.RecoverLatencyMs())
		} else {
			var still []string
			if !recoverError {
				still = append(still, fmt.Sprintf("error_rate=%.4f >= %.4f", agg.ErrorRate, e.cfg.RecoverErrorRate()))
			}
			if !recoverLatency {
				still = append(still, fmt.Sprintf("latency_p99=%dms >= %dms", agg.P99LatencyMs, e.cfg.RecoverLatencyMs()))
			}
			d.Reason = fmt.Sprintf("still above hysteresis margin: %s", joinReasons(still))
		}
	} else {
		// Hysteresis disabled → recover on any healthy evaluation.
		recoverError = agg.ErrorRate < e.cfg.ErrorRateThreshold
		recoverLatency = agg.P99LatencyMs < e.cfg.LatencyThresholdMs
		if recoverError && recoverLatency {
			d.Recover = true
			d.Reason = "within normal thresholds (hysteresis disabled)"
		}
	}

	return d
}

// EvaluateRecovery is the legacy window-aggregate version, kept for callers
// that want to evaluate against the full sliding window rather than the
// latest snapshot.
func (e *Evaluator) EvaluateRecovery(agg AggregatedMetrics) Decision {
	agg.Compute()
	return e.evaluateRecovery(agg)
}

func (e *Evaluator) evaluateRecovery(agg AggregatedMetrics) Decision {
	d := Decision{
		EvaluatedAt:       time.Now().UTC(),
		ErrorRate:         agg.ErrorRate,
		LatencyP99Ms:      agg.P99LatencyMs,
		ErrorRateLimit:    e.cfg.RecoverErrorRate(),
		LatencyP99LimitMs: e.cfg.RecoverLatencyMs(),
	}

	if agg.TotalCount < e.cfg.MinSampleCount {
		d.Reason = fmt.Sprintf("insufficient traffic (samples=%d, min=%d)", agg.TotalCount, e.cfg.MinSampleCount)
		return d
	}

	recoverError := agg.ErrorRate < e.cfg.RecoverErrorRate()
	recoverLatency := agg.P99LatencyMs < e.cfg.RecoverLatencyMs()

	if e.cfg.Hysteresis.Enabled {
		if recoverError && recoverLatency {
			d.Recover = true
			d.Reason = fmt.Sprintf("hysteresis: error_rate=%.4f < %.4f, latency_p99=%dms < %dms",
				agg.ErrorRate, e.cfg.RecoverErrorRate(), agg.P99LatencyMs, e.cfg.RecoverLatencyMs())
		} else {
			var still []string
			if !recoverError {
				still = append(still, fmt.Sprintf("error_rate=%.4f >= %.4f", agg.ErrorRate, e.cfg.RecoverErrorRate()))
			}
			if !recoverLatency {
				still = append(still, fmt.Sprintf("latency_p99=%dms >= %dms", agg.P99LatencyMs, e.cfg.RecoverLatencyMs()))
			}
			d.Reason = fmt.Sprintf("still above hysteresis margin: %s", joinReasons(still))
		}
	} else {
		recoverError = agg.ErrorRate < e.cfg.ErrorRateThreshold
		recoverLatency = agg.P99LatencyMs < e.cfg.LatencyThresholdMs
		if recoverError && recoverLatency {
			d.Recover = true
			d.Reason = "within normal thresholds (hysteresis disabled)"
		}
	}

	return d
}

func joinReasons(reasons []string) string {
	// simple join without allocating a slice of strings
	out := ""
	for i, r := range reasons {
		if i > 0 {
			out += ", "
		}
		out += r
	}
	return out
}
