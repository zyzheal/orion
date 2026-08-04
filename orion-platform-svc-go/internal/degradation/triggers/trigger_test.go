package triggers

import (
	"context"
	"strings"
	"testing"
	"time"
)

func defaultTestConfig() TriggerConfig {
	c := DefaultTriggerConfig()
	c.ErrorRateThreshold = 0.10 // 10%
	c.LatencyThresholdMs = 500
	c.MinSampleCount = 1
	c.WindowSize = 5
	c.EvaluateInterval = 100 * time.Millisecond
	c.Hysteresis.HealthStreakRequired = 2
	c.Hysteresis.RecoverErrorRateMargin = 0.05
	c.Hysteresis.RecoverLatencyMarginMs = 100
	return c
}

func healthySnapshot() MetricSnapshot {
	return MetricSnapshot{
		ErrorCount:   0,
		TotalCount:   500,
		LatencySamples: latencies(500, 150, 200),
	}
}

func snapshotWithErrorRate(rate float64, n int64) MetricSnapshot {
	err := int(float64(n) * rate)
	if err > int(n) {
		err = int(n)
	}
	return MetricSnapshot{
		ErrorCount:   err,
		TotalCount:   int(n),
		LatencySamples: latencies(n, 200, 300),
	}
}

// snapshotWithLatencyP99 builds a MetricSnapshot whose P99 latency
// (computed via int((len-1)*0.99)) is at least `p99`.  It fills the
// bottom 1% with `p99` so that the P99 index always lands on the high
// value regardless of small n.
func snapshotWithLatencyP99(p99 int64, n int) MetricSnapshot {
	s := make([]int64, n)
	for i := range s {
		s[i] = 100
	}
	// P99 idx = int((n-1)*0.99).  Push p99 values from idx 999 down to
	// the P99 index inclusive, so sorted[p99Idx] == p99.
	cutoff := int(float64(n-1) * 0.99)
	for i := n - 1; i >= cutoff && i >= 0; i-- {
		s[i] = p99
	}
	return MetricSnapshot{
		ErrorCount:     0,
		TotalCount:     n,
		LatencySamples: s,
	}
}

func latencies(n, base, max int64) []int64 {
	s := make([]int64, n)
	for i := range s {
		s[i] = base + int64(i)%(max-base)
	}
	return s
}

// ---------- Config tests ----------

func TestConfigValidate(t *testing.T) {
	t.Run("valid", func(t *testing.T) {
		if err := defaultTestConfig().Validate(); err != nil {
			t.Fatalf("expected valid, got %v", err)
		}
	})
	t.Run("errorRate>1", func(t *testing.T) {
		c := defaultTestConfig()
		c.ErrorRateThreshold = 1.1
		if err := c.Validate(); err != ErrInvalidErrorRateThreshold {
			t.Fatalf("expected ErrInvalidErrorRateThreshold, got %v", err)
		}
	})
	t.Run("negativeErrorRate", func(t *testing.T) {
		c := defaultTestConfig()
		c.ErrorRateThreshold = -0.1
		if err := c.Validate(); err != ErrInvalidErrorRateThreshold {
			t.Fatalf("expected ErrInvalidErrorRateThreshold, got %v", err)
		}
	})
	t.Run("latency<=0", func(t *testing.T) {
		c := defaultTestConfig()
		c.LatencyThresholdMs = 0
		if err := c.Validate(); err != ErrInvalidLatencyThreshold {
			t.Fatalf("expected ErrInvalidLatencyThreshold, got %v", err)
		}
	})
	t.Run("windowSize<2", func(t *testing.T) {
		c := defaultTestConfig()
		c.WindowSize = 1
		if err := c.Validate(); err != ErrInvalidWindowSize {
			t.Fatalf("expected ErrInvalidWindowSize, got %v", err)
		}
	})
}

func TestConfigHysteresis(t *testing.T) {
	c := TriggerConfig{
		ErrorRateThreshold:  0.10,
		LatencyThresholdMs:  500,
		WindowSize:          5,
		MinSampleCount:      1,
		Hysteresis: HysteresisConfig{
			RecoverErrorRateMargin:  0.03,
			RecoverLatencyMarginMs:  100,
			HealthStreakRequired:    2,
		},
	}
	if r := c.RecoverErrorRate(); r != 0.07 {
		t.Fatalf("RecoverErrorRate() = %f, want 0.07", r)
	}
	if l := c.RecoverLatencyMs(); l != 400 {
		t.Fatalf("RecoverLatencyMs() = %d, want 400", l)
	}
}

// ---------- Snapshot tests ----------

func TestSnapshotP99(t *testing.T) {
	s := MetricSnapshot{
		ErrorCount:   0,
		TotalCount:   100,
		LatencySamples: latencies(100, 100, 200),
	}
	p99 := s.P99Latency()
	if p99 <= 100 || p99 > 200 {
		t.Fatalf("P99 latency %d out of expected range [100,200]", p99)
	}
	empty := MetricSnapshot{}
	if empty.P99Latency() != 0 {
		t.Fatalf("empty snapshot P99 should be 0")
	}
}

func TestSnapshotErrorRate(t *testing.T) {
	s := MetricSnapshot{ErrorCount: 10, TotalCount: 100}
	if r := s.ErrorRate(); r != 0.1 {
		t.Fatalf("ErrorRate() = %f, want 0.1", r)
	}
	emptyErr := MetricSnapshot{}
	if emptyErr.ErrorRate() != 0 {
		t.Fatalf("empty snapshot ErrorRate() should be 0")
	}
}

func TestSnapshotValid(t *testing.T) {
	notEmpty := MetricSnapshot{TotalCount: 10}
	if notEmpty.Valid() != true {
		t.Fatal("snapshot with traffic should be valid")
	}
	emptyV := MetricSnapshot{}
	if emptyV.Valid() != false {
		t.Fatal("empty snapshot should be invalid")
	}
}

// ---------- Evaluator tests ----------

func TestEvaluator_TriggerOnErrorRate(t *testing.T) {
	c := defaultTestConfig()
	eval := NewEvaluator(c, nil)
	d := eval.EvaluateSnapshot(snapshotWithErrorRate(0.15, 1000))
	if !d.Trigger {
		t.Fatalf("expected trigger on 15%% error rate, got reason=%s", d.Reason)
	}
}

func TestEvaluator_TriggerOnLatency(t *testing.T) {
	c := defaultTestConfig()
	eval := NewEvaluator(c, nil)
	d := eval.EvaluateSnapshot(snapshotWithLatencyP99(800, 1000))
	if !d.Trigger {
		t.Fatalf("expected trigger on 800ms P99, got reason=%s", d.Reason)
	}
}

func TestEvaluator_NoTriggerWhenHealthy(t *testing.T) {
	c := defaultTestConfig()
	eval := NewEvaluator(c, nil)
	d := eval.EvaluateSnapshot(healthySnapshot())
	if d.Trigger {
		t.Fatalf("expected no trigger when healthy, got reason=%s", d.Reason)
	}
}

func TestEvaluator_InsufficientTraffic(t *testing.T) {
	c := defaultTestConfig()
	c.MinSampleCount = 10
	eval := NewEvaluator(c, nil)
	d := eval.EvaluateSnapshot(MetricSnapshot{
		ErrorCount:   5,
		TotalCount:   5,
		LatencySamples: nil,
	})
	if d.Trigger {
		t.Fatalf("expected no trigger with insufficient samples")
	}
	if d.Reason == "" {
		t.Fatalf("expected reason to be set")
	}
}

func TestEvaluator_RecoveryNoHysteresis(t *testing.T) {
	c := defaultTestConfig()
	c.Hysteresis.Enabled = false
	eval := NewEvaluator(c, nil)
	agg := AggregatedMetrics{
		ErrorCount:     0,
		TotalCount:     1000,
		LatencySamples: latencies(1000, 100, 200),
	}
	d := eval.EvaluateRecovery(agg)
	if !d.Recover {
		t.Fatalf("expected recover when healthy (hysteresis disabled)")
	}
}

func TestEvaluator_RecoveryWithHysteresis(t *testing.T) {
	c := defaultTestConfig()
	eval := NewEvaluator(c, nil)
	agg := AggregatedMetrics{
		ErrorCount:     70,
		TotalCount:     1000,
		LatencySamples: latencies(1000, 200, 300),
	}
	d := eval.EvaluateRecovery(agg)
	if d.Recover {
		t.Fatalf("expected no recover at 7%% (above margin 5%%)")
	}

	agg.ErrorCount = 30
	d = eval.EvaluateRecovery(agg)
	if !d.Recover {
		t.Fatalf("expected recover at 3%% (below margin 5%%)")
	}
}

func TestEvaluator_RecoveryBlockedByLatencyHysteresis(t *testing.T) {
	c := defaultTestConfig()
	eval := NewEvaluator(c, nil)
	agg := AggregatedMetrics{
		ErrorCount:     0,
		TotalCount:     1000,
		LatencySamples: latencies(1000, 400, 500),
	}
	d := eval.EvaluateRecovery(agg)
	if d.Recover {
		t.Fatalf("expected no recover at P99 ~490ms (above margin 400ms)")
	}
}

// ---------- Trigger state-machine tests ----------

func TestTrigger_ErrorRateExceedsThreshold(t *testing.T) {
	c := defaultTestConfig()
	tr := NewTrigger(c, nil)
	d := tr.Observe(snapshotWithErrorRate(0.15, 1000))
	if tr.State() != StateDegraded {
		t.Fatalf("expected DEGRADED, got %s", tr.State())
	}
	if !d.Trigger {
		t.Fatalf("expected trigger decision")
	}
}

func TestTrigger_LatencyExceedsThreshold(t *testing.T) {
	c := defaultTestConfig()
	tr := NewTrigger(c, nil)
	d := tr.Observe(snapshotWithLatencyP99(900, 1000))
	if tr.State() != StateDegraded {
		t.Fatalf("expected DEGRADED, got %s", tr.State())
	}
	if !d.Trigger {
		t.Fatalf("expected trigger decision")
	}
}

func TestTrigger_RemainsNormalWhenHealthy(t *testing.T) {
	c := defaultTestConfig()
	tr := NewTrigger(c, nil)
	d := tr.Observe(healthySnapshot())
	if tr.State() != StateNormal {
		t.Fatalf("expected NORMAL, got %s", tr.State())
	}
	if d.Trigger {
		t.Fatalf("expected no trigger")
	}
}

func TestTrigger_HysteresisRecoveryDoesNotFlap(t *testing.T) {
	c := defaultTestConfig()
	tr := NewTrigger(c, nil)

	tr.Observe(snapshotWithErrorRate(0.20, 1000))
	if tr.State() != StateDegraded {
		t.Fatalf("expected DEGRADED after 20%% errors")
	}
	tr.Observe(snapshotWithErrorRate(0.08, 1000))
	if tr.State() != StateDegraded {
		t.Fatalf("expected DEGRADED at 8%% (above margin 5%%)")
	}
	tr.Observe(snapshotWithErrorRate(0.06, 1000))
	if tr.State() != StateDegraded {
		t.Fatalf("expected DEGRADED at 6%% (above margin 5%%)")
	}
}

func TestTrigger_RecoversAfterConsecutiveHealthyEvaluations(t *testing.T) {
	c := defaultTestConfig()
	c.Hysteresis.HealthStreakRequired = 2
	tr := NewTrigger(c, nil)

	tr.Observe(snapshotWithErrorRate(0.20, 1000))
	if tr.State() != StateDegraded {
		t.Fatalf("expected DEGRADED")
	}
	tr.Observe(snapshotWithErrorRate(0.02, 1000))
	if tr.State() != StateDegraded {
		t.Fatalf("still DEGRADED after 1st healthy eval (streak=%d)", tr.HealthStreak())
	}
	if tr.HealthStreak() != 1 {
		t.Fatalf("expected streak=1, got %d", tr.HealthStreak())
	}
	tr.Observe(snapshotWithErrorRate(0.02, 1000))
	if tr.State() != StateNormal {
		t.Fatalf("expected NORMAL after 2nd healthy eval, got %s", tr.State())
	}
	if tr.HealthStreak() != 0 {
		t.Fatalf("expected streak reset, got %d", tr.HealthStreak())
	}
}

func TestTrigger_HealthStreakResetsWhenHysteresisMarginBreached(t *testing.T) {
	c := defaultTestConfig()
	c.Hysteresis.HealthStreakRequired = 3
	tr := NewTrigger(c, nil)

	tr.Observe(snapshotWithErrorRate(0.20, 1000))
	tr.Observe(snapshotWithErrorRate(0.02, 1000))
	tr.Observe(snapshotWithErrorRate(0.02, 1000))
	if tr.HealthStreak() != 2 {
		t.Fatalf("expected streak=2, got %d", tr.HealthStreak())
	}
	tr.Observe(snapshotWithErrorRate(0.08, 1000))
	if tr.HealthStreak() != 0 {
		t.Fatalf("expected streak reset, got %d", tr.HealthStreak())
	}
}

func TestTrigger_ZeroTrafficDoesNotTrigger(t *testing.T) {
	c := defaultTestConfig()
	c.MinSampleCount = 1
	tr := NewTrigger(c, nil)
	d := tr.Observe(MetricSnapshot{
		ErrorCount:     0,
		TotalCount:     0,
		LatencySamples: nil,
	})
	if tr.State() != StateNormal {
		t.Fatalf("expected NORMAL with zero traffic, got %s", tr.State())
	}
	if d.Trigger {
		t.Fatalf("expected no trigger on zero traffic")
	}
}

func TestTrigger_CallbackFiresOnTransition(t *testing.T) {
	c := defaultTestConfig()
	var calledWith DegradationState
	tr := NewTrigger(c, nil)
	tr.SetStateChangeCallback(func(state DegradationState, d Decision) {
		calledWith = state
	})
	tr.Observe(snapshotWithErrorRate(0.20, 1000))
	if calledWith != StateDegraded {
		t.Fatalf("expected callback with DEGRADED, got %s", calledWith)
	}
}

func TestTrigger_Reset(t *testing.T) {
	c := defaultTestConfig()
	tr := NewTrigger(c, nil)
	tr.Observe(snapshotWithErrorRate(0.20, 1000))
	if tr.State() != StateDegraded {
		t.Fatalf("expected DEGRADED before reset")
	}
	tr.Reset()
	if tr.State() != StateNormal {
		t.Fatalf("expected NORMAL after reset, got %s", tr.State())
	}
	if tr.HealthStreak() != 0 {
		t.Fatalf("expected streak=0 after reset, got %d", tr.HealthStreak())
	}
}

func TestTrigger_LastDecision(t *testing.T) {
	c := defaultTestConfig()
	tr := NewTrigger(c, nil)
	tr.Observe(snapshotWithErrorRate(0.20, 1000))
	d := tr.LastDecision()
	if d.ErrorRate < 0.19 {
		t.Fatalf("LastDecision errorRate %f too low", d.ErrorRate)
	}
}

func TestTrigger_BothErrorAndLatencyBreach(t *testing.T) {
	c := defaultTestConfig()
	tr := NewTrigger(c, nil)
	s := MetricSnapshot{
		ErrorCount:     300,
		TotalCount:     1000,
		LatencySamples: latencies(1000, 600, 800),
	}
	d := tr.Observe(s)
	if tr.State() != StateDegraded {
		t.Fatalf("expected DEGRADED when both breach")
	}
	if !strings.Contains(d.Reason, "error_rate") || !strings.Contains(d.Reason, "latency_p99") {
		t.Fatalf("expected reason to mention both, got: %s", d.Reason)
	}
}

func TestTrigger_EvaluateNoOp(t *testing.T) {
	c := defaultTestConfig()
	tr := NewTrigger(c, nil)
	d := tr.Evaluate()
	if d.Trigger {
		t.Fatalf("expected no trigger on empty window")
	}
	tr.Observe(healthySnapshot())
	d = tr.Evaluate()
	if d.Trigger {
		t.Fatalf("expected no re-trigger")
	}
}

func TestTrigger_IsDegraded(t *testing.T) {
	c := defaultTestConfig()
	tr := NewTrigger(c, nil)
	if tr.IsDegraded() {
		t.Fatal("expected !IsDegraded at start")
	}
	tr.Observe(snapshotWithErrorRate(0.20, 1000))
	if !tr.IsDegraded() {
		t.Fatal("expected IsDegraded after trip")
	}
}

// ---------- SlidingWindow tests ----------

func TestSlidingWindow(t *testing.T) {
	w := NewSlidingWindow(3)
	for i := 0; i < 5; i++ {
		w.Push(MetricSnapshot{
			ErrorCount:   i,
			TotalCount:   10,
			Timestamp:    time.Now().Add(time.Duration(i) * time.Second),
		})
	}
	if w.Count() != 3 {
		t.Fatalf("expected count=3, got %d", w.Count())
	}
	snapshots := w.All()
	if len(snapshots) != 3 {
		t.Fatalf("expected 3 snapshots, got %d", len(snapshots))
	}
	if snapshots[0].ErrorCount != 2 {
		t.Fatalf("first snapshot errorCount=%d, want 2", snapshots[0].ErrorCount)
	}
	if snapshots[2].ErrorCount != 4 {
		t.Fatalf("last snapshot errorCount=%d, want 4", snapshots[2].ErrorCount)
	}
	agg := w.Aggregated()
	agg.Compute()
	if agg.TotalCount != 30 {
		t.Fatalf("expected TotalCount=30, got %d", agg.TotalCount)
	}
	w.Clear()
	if w.Count() != 0 {
		t.Fatalf("expected count=0 after clear, got %d", w.Count())
	}
}

func TestAggregatedMetrics_Compute(t *testing.T) {
	agg := AggregatedMetrics{
		ErrorCount:     50,
		TotalCount:     1000,
		LatencySamples: latencies(100, 100, 200),
	}
	agg.Compute()
	if agg.ErrorRate != 0.05 {
		t.Fatalf("expected errorRate=0.05, got %f", agg.ErrorRate)
	}
	if agg.P99LatencyMs <= 0 || agg.P99LatencyMs > 200 {
		t.Fatalf("P99LatencyMs=%d out of range", agg.P99LatencyMs)
	}
}

// ---------- Background evaluation ----------

func TestBackgroundEvaluation(t *testing.T) {
	c := defaultTestConfig()
	c.EvaluateInterval = 50 * time.Millisecond
	tr := NewTrigger(c, nil)

	ctx, cancel := context.WithCancel(context.Background())
	tr.StartBackgroundEvaluation(ctx)
	tr.Observe(snapshotWithErrorRate(0.20, 1000))

	time.Sleep(150 * time.Millisecond)
	cancel()
	tr.StopBackgroundEvaluation()

	if tr.State() != StateDegraded {
		t.Fatalf("expected DEGRADED, got %s", tr.State())
	}
}

// ---------- State helpers ----------

func TestDegradationStateString(t *testing.T) {
	if StateNormal.String() != "NORMAL" {
		t.Fatalf("StateNormal.String() = %s", StateNormal.String())
	}
	if StateDegraded.String() != "DEGRADED" {
		t.Fatalf("StateDegraded.String() = %s", StateDegraded.String())
	}
}

func TestHysteresisDisabled(t *testing.T) {
	c := defaultTestConfig()
	c.Hysteresis.Enabled = false
	c.Hysteresis.HealthStreakRequired = 1
	tr := NewTrigger(c, nil)

	tr.Observe(snapshotWithErrorRate(0.20, 1000))
	if tr.State() != StateDegraded {
		t.Fatalf("expected DEGRADED")
	}
	tr.Observe(snapshotWithErrorRate(0.02, 1000))
	if tr.State() != StateNormal {
		t.Fatalf("expected NORMAL immediately (hysteresis disabled), got %s", tr.State())
	}
}

func TestEvalWindow(t *testing.T) {
	c := defaultTestConfig()
	eval := NewEvaluator(c, nil)
	agg := AggregatedMetrics{
		ErrorCount:     200,
		TotalCount:     1000,
		LatencySamples: latencies(1000, 100, 200),
	}
	d := eval.EvaluateAggregated(agg)
	if !d.Trigger {
		t.Fatalf("expected trigger on aggregated 20%% error rate")
	}
}
