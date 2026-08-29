package service

import "testing"

func TestCIEvalConfig_Defaults(t *testing.T) {
	cfg := CIEvalConfig{}
	if cfg.Model != "" {
		t.Error("empty Model signals default")
	}
	if cfg.TopK != 0 {
		t.Error("zero TopK signals default")
	}
	if cfg.Threshold != 0 {
		t.Error("zero Threshold means no gate")
	}
}

func TestCIEvalConfig_ScenarioFiltering(t *testing.T) {
	cfg := CIEvalConfig{Scenarios: []string{"TR-09", "TR-11"}}
	if len(cfg.Scenarios) != 2 {
		t.Fatalf("Scenarios = %d, want 2", len(cfg.Scenarios))
	}
}

func TestCIEvalSummary_Structure(t *testing.T) {
	s := CIEvalSummary{
		TotalScenarios: 3, Passed: 2, Failed: 1,
		OverallPassRate: 0.75, MeetsThreshold: false,
	}
	if s.TotalScenarios != 3 {
		t.Error("TotalScenarios mismatch")
	}
	if s.MeetsThreshold {
		t.Error("MeetsThreshold should be false with failures")
	}
}

func TestCIEvalResult_Calculation(t *testing.T) {
	r := CIEvalResult{
		Scenario: "TR-09", Status: "completed",
		Pass: 3, Total: 4, PassRate: 0.75, AvgScore: 0.82,
	}
	if r.PassRate != 0.75 {
		t.Errorf("PassRate = %f, want 0.75", r.PassRate)
	}
	if r.Scenario != "TR-09" {
		t.Error("Scenario mismatch")
	}
}
