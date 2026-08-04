package triggers

import (
	"context"
	"sync"
	"time"

	"go.uber.org/zap"
)

// DegradationState is the lifecycle state of a policy managed by Trigger.
type DegradationState int

const (
	StateNormal DegradationState = iota
	StateDegraded
)

func (s DegradationState) String() string {
	switch s {
	case StateNormal:
		return "NORMAL"
	case StateDegraded:
		return "DEGRADED"
	default:
		return "UNKNOWN"
	}
}

// CallbackFunc is invoked by Trigger when the degradation state changes.
type CallbackFunc func(state DegradationState, decision Decision)

// Trigger is the automatic degradation orchestrator for a single policy.
//
// Architecture:
//   1. Clients push MetricSnapshots into the sliding window via Observe().
//   2. On each Evaluate() call (or on a background tick), the window is
//      aggregated and passed through the Evaluator.
//   3. When thresholds are breached the state moves NORMAL → DEGRADED,
//      callbacks fire, and the circuit-breaker (if configured) is opened.
//   4. Recovery requires HealthStreakRequired consecutive healthy
//      evaluations *below* the hysteresis margin: DEGRADED → NORMAL.
type Trigger struct {
	cfg       TriggerConfig
	window    *SlidingWindow
	evaluator *Evaluator
	state     DegradationState
	streak    int // consecutive healthy evaluations under hysteresis margin
	log       *zap.Logger
	mu        sync.RWMutex

	onStateChange CallbackFunc

	tickerStop chan struct{}
	done       chan struct{}
}

// NewTrigger creates a new automatic degradation trigger.
// Pass nil for log to fall back to a no-op logger.
func NewTrigger(cfg TriggerConfig, log *zap.Logger) *Trigger {
	if log == nil {
		log = zap.NewNop()
	}
	log = log.Named("degradation-trigger").With(zap.String("trigger", cfg.CircuitBreakerRef))
	return &Trigger{
		cfg:       cfg,
		window:    NewSlidingWindow(cfg.WindowSize),
		evaluator: NewEvaluator(cfg, log),
		state:     StateNormal,
		done:      make(chan struct{}),
		log:       log,
	}
}

// SetStateChangeCallback registers a function to call when the state
// transitions.
func (t *Trigger) SetStateChangeCallback(cb CallbackFunc) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.onStateChange = cb
}

// Observe pushes a metric snapshot into the sliding window and triggers
// an immediate evaluation.
func (t *Trigger) Observe(s MetricSnapshot) Decision {
	t.window.Push(s)
	return t.Evaluate()
}

// Evaluate decides the current state based on the latest snapshot in the
// window (Prometheus-style: current value, not historical average).
func (t *Trigger) Evaluate() Decision {
	snapshots := t.window.All()
	if len(snapshots) == 0 {
		return Decision{Reason: "empty window"}
	}
	latest := snapshots[len(snapshots)-1]

	t.mu.Lock()
	defer t.mu.Unlock()

	switch t.state {
	case StateNormal:
		d := t.evaluator.EvaluateSnapshot(latest)
		if d.Trigger {
			t.state = StateDegraded
			t.streak = 0
			t.log.Warn("DEGRADED",
				zap.Float64("errorRate", d.ErrorRate),
				zap.Int64("latencyP99Ms", d.LatencyP99Ms),
				zap.String("reason", d.Reason))
			t.fireCallback(StateDegraded, d)
		}
		return d

	case StateDegraded:
		// Check whether we may recover.  Only the recovery evaluator
		// (with hysteresis) is consulted while degraded.
		d := t.evaluator.EvaluateRecoverySnapshot(latest)
		if d.Recover {
			t.streak++
			if t.streak >= t.cfg.Hysteresis.HealthStreakRequired {
				t.state = StateNormal
				// streak will be cleared after callback, but we log the value.
				streak := t.streak
				t.streak = 0
				t.log.Info("RECOVERED",
					zap.Int("healthStreak", streak),
					zap.Float64("errorRate", d.ErrorRate),
					zap.Int64("latencyP99Ms", d.LatencyP99Ms),
					zap.String("reason", d.Reason))
				t.fireCallback(StateNormal, d)
			}
		} else {
			// Health streak reset — metrics moved back above hysteresis.
			t.streak = 0
		}
		return d

	default:
		d := t.evaluator.EvaluateSnapshot(latest)
		d.Reason = "unknown state, normal evaluation returned: " + d.Reason
		return d
	}
}

// State returns the current degradation state.
func (t *Trigger) State() DegradationState {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.state
}

// HealthStreak returns the current consecutive healthy evaluation count
// (only meaningful while in DEGRADED state).
func (t *Trigger) HealthStreak() int {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.streak
}

// IsDegraded is a convenience boolean.
func (t *Trigger) IsDegraded() bool {
	return t.State() == StateDegraded
}

// AggregatedMetrics returns the latest window aggregate for diagnostics.
func (t *Trigger) AggregatedMetrics() AggregatedMetrics {
	return t.window.Aggregated()
}

// StartBackgroundEvaluation runs periodic evaluations in a goroutine until
// the given context is cancelled.  Useful when metrics are published via a
// separate channel and you don't want to call Observe() from every caller.
func (t *Trigger) StartBackgroundEvaluation(ctx context.Context) {
	t.mu.Lock()
	stop := make(chan struct{})
	t.tickerStop = stop
	t.mu.Unlock()

	ticker := time.NewTicker(t.cfg.EvaluateInterval)
	go func() {
		defer ticker.Stop()
		defer close(t.done)
		for {
			select {
			case <-ctx.Done():
				t.log.Info("background evaluation stopped (context)")
				return
			case <-stop:
				t.log.Info("background evaluation stopped (manual)")
				return
			case <-ticker.C:
			}
			// Acquire lock outside the select to avoid holding it during cancellation.
			t.Evaluate()
		}
	}()
}

// StopBackgroundEvaluation signals the background loop to exit.
func (t *Trigger) StopBackgroundEvaluation() {
	t.mu.Lock()
	stop := t.tickerStop
	t.tickerStop = nil
	t.mu.Unlock()

	if stop != nil {
		select {
		case stop <- struct{}{}:
		default:
		}
		// Wait up to 2s for the background goroutine to drain; don't deadlock.
		done := time.NewTimer(2 * time.Second)
		select {
		case <-t.done:
		case <-done.C:
		}
		done.Stop()
	}
}

// Reset forcefully moves the trigger back to NORMAL (used by admin resolve).
func (t *Trigger) Reset() {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.state != StateNormal {
		t.state = StateNormal
		t.streak = 0
		t.log.Info("manual reset to NORMAL")
	}
}

// ClearWindow clears the historical snapshots.
func (t *Trigger) ClearWindow() {
	t.window.Clear()
}

// LastDecision returns a synthetic decision describing the current window.
func (t *Trigger) LastDecision() Decision {
	agg := t.window.Aggregated()
	agg.Compute()
	d := t.evaluator.EvaluateAggregated(agg)
	t.mu.RLock()
	defer t.mu.RUnlock()
	d.HealthStreak = t.streak
	return d
}

func (t *Trigger) fireCallback(state DegradationState, d Decision) {
	cb := t.onStateChange
	if cb != nil {
		cb(state, d)
	}
}
