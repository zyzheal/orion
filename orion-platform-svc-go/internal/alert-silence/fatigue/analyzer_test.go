package fatigue

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func makeAnalyzer() *Analyzer {
	return NewAnalyzer(10*time.Minute, 30.0)
}

// --- RecordAlert tests ---

func TestRecordAlert_Normal(t *testing.T) {
	a := makeAnalyzer()
	a.RecordAlert("t1", "cpu-high", "critical")
	info, ok := a.GetRuleFatigue("t1", "cpu-high")
	require.True(t, ok)
	assert.Equal(t, 1, info.TotalAlerts)
	assert.Equal(t, "cpu-high", info.RuleName)
	assert.Equal(t, false, info.SilenceRatio == 1)
}

func TestRecordAlert_HighFrequency(t *testing.T) {
	a := NewAnalyzer(10*time.Minute, 20.0)
	for i := 0; i < 30; i++ {
		a.RecordAlert("t1", "memory-leak", "high")
	}
	info, ok := a.GetRuleFatigue("t1", "memory-leak")
	require.True(t, ok)
	assert.Equal(t, 30, info.TotalAlerts)
	assert.True(t, info.Score >= 20, "score %f should be >= 20", info.Score)
}

func TestRecordAlert_EmptyTenant(t *testing.T) {
	a := makeAnalyzer()
	a.RecordAlert("", "rule", "info")
	_, ok := a.GetRuleFatigue("", "rule")
	assert.False(t, ok)
}

func TestRecordAlert_EmptyRule(t *testing.T) {
	a := makeAnalyzer()
	a.RecordAlert("t1", "", "info")
	_, ok := a.GetRuleFatigue("t1", "")
	assert.False(t, ok)
}

// --- RecordSilencedAlert tests ---

func TestRecordSilencedAlert_CalculatesRatio(t *testing.T) {
	a := makeAnalyzer()
	a.RecordAlert("t1", "rule-a", "high")
	a.RecordAlert("t1", "rule-a", "high")
	a.RecordSilencedAlert("t1", "rule-a", "high")
	info, ok := a.GetRuleFatigue("t1", "rule-a")
	require.True(t, ok)
	assert.Equal(t, 3, info.TotalAlerts)
	assert.Equal(t, 1.0/3, info.SilenceRatio)
}

// --- GetFatigueScore tests ---

func TestGetFatigueScore_MultipleRules(t *testing.T) {
	a := makeAnalyzer()
	for i := 0; i < 5; i++ {
		a.RecordAlert("t1", "rule-x", "critical")
	}
	for i := 0; i < 2; i++ {
		a.RecordAlert("t1", "rule-y", "low")
	}
	scores := a.GetFatigueScore("t1")
	assert.Len(t, scores, 2)
	assert.NotNil(t, scores["rule-x"])
	assert.NotNil(t, scores["rule-y"])
}

func TestGetFatigueScore_TenantIsolation(t *testing.T) {
	a := makeAnalyzer()
	for i := 0; i < 5; i++ {
		a.RecordAlert("t1", "rule-a", "high")
		a.RecordAlert("t2", "rule-a", "high")
	}
	s1 := a.GetFatigueScore("t1")
	s2 := a.GetFatigueScore("t2")
	assert.Equal(t, 5, s1["rule-a"].TotalAlerts)
	assert.Equal(t, 5, s2["rule-a"].TotalAlerts)
}

func TestGetFatigueScore_AfterSilence(t *testing.T) {
	a := makeAnalyzer()
	for i := 0; i < 10; i++ {
		a.RecordSilencedAlert("t1", "rule-b", "info")
	}
	info, ok := a.GetRuleFatigue("t1", "rule-b")
	require.True(t, ok)
	assert.Equal(t, 10, info.TotalAlerts)
	assert.Equal(t, 1.0, info.SilenceRatio)
}

// --- Mixed signals ---

func TestGetRuleFatigue_MixedSignals(t *testing.T) {
	a := makeAnalyzer()
	for i := 0; i < 3; i++ {
		a.RecordAlert("t1", "rule-m", "critical")
	}
	for i := 0; i < 2; i++ {
		a.RecordSilencedAlert("t1", "rule-m", "high")
	}
	info, ok := a.GetRuleFatigue("t1", "rule-m")
	require.True(t, ok)
	assert.Equal(t, 5, info.TotalAlerts)
	assert.Equal(t, 0.4, info.SilenceRatio)
	// Score should be moderate due to mixed signals (some silenced, some critical).
	assert.True(t, info.Score > 0)
}

func TestGetRuleFatigue_EmptyRule(t *testing.T) {
	a := makeAnalyzer()
	_, ok := a.GetRuleFatigue("t1", "nonexistent")
	assert.False(t, ok)
}

func TestGetRuleFatigue_OnlyOneAlert(t *testing.T) {
	a := makeAnalyzer()
	a.RecordAlert("t1", "once", "low")
	info, ok := a.GetRuleFatigue("t1", "once")
	require.True(t, ok)
	assert.Equal(t, 1, info.TotalAlerts)
	assert.Equal(t, 0.0, info.AvgInterval) // no interval with single alert
}

// --- AutoSilenceRecommendations ---

func TestAutoSilenceRecommendations_ReturnsHighFatigueRules(t *testing.T) {
	a := NewAnalyzer(10*time.Minute, 10.0)
	for i := 0; i < 30; i++ {
		a.RecordAlert("t1", "chatty-rule", "critical")
	}
	a.RecordAlert("t1", "quiet-rule", "low")
	names := a.AutoSilenceRecommendations("t1")
	found := false
	for _, n := range names {
		if n == "chatty-rule" {
			found = true
		}
	}
	assert.True(t, found, "chatty-rule should be recommended for silencing")
}

func TestAutoSilenceRecommendations_NoRules(t *testing.T) {
	a := makeAnalyzer()
	names := a.AutoSilenceRecommendations("t1")
	assert.Empty(t, names)
}

// --- Recommendation strings ---

func TestRecommendation_AddToSilence(t *testing.T) {
	info := computeFatigue("r1", make([]AlertRecord, 20), 5.0)
	assert.Equal(t, "add to silence list", info.Recommendation)
}

func TestRecommendation_Ok(t *testing.T) {
	info := computeFatigue("r1", []AlertRecord{
		{Ts: time.Now().Add(-5 * time.Minute), Severity: "low", Silenced: true},
	}, 30.0)
	assert.Equal(t, "ok", info.Recommendation)
}

// --- FatigueInfo fields ---

func TestFatigueInfo_Struct(t *testing.T) {
	info := FatigueInfo{
		RuleName:       "test-rule",
		TotalAlerts:    10,
		AvgInterval:    30.5,
		SilenceRatio:   0.3,
		Score:          25.0,
		Recommendation: "monitor",
	}
	assert.Equal(t, "test-rule", info.RuleName)
	assert.Equal(t, 10, info.TotalAlerts)
	assert.Equal(t, 30.5, info.AvgInterval)
}

// --- Window pruning ---

func TestAnalyzer_WindowPruning(t *testing.T) {
	a := NewAnalyzer(5*time.Second, 30.0)
	a.RecordAlert("t1", "rule-z", "high")
	// Wait for window to expire.
	time.Sleep(6 * time.Second)
	a.RecordAlert("t1", "rule-z", "high")
	info, ok := a.GetRuleFatigue("t1", "rule-z")
	require.True(t, ok)
	assert.Equal(t, 1, info.TotalAlerts)
}
