package service

import (
	"testing"
)

func TestAnalyzeCostSavings(t *testing.T) {
	svc := NewService(nil)
	analysis := svc.AnalyzeCostSavings("tenant-1")
	if analysis.TenantID != "tenant-1" {
		t.Errorf("expected tenant-1, got %s", analysis.TenantID)
	}
	if analysis.TotalSpend <= 0 {
		t.Errorf("expected positive TotalSpend, got %f", analysis.TotalSpend)
	}
	if len(analysis.Opportunities) == 0 {
		t.Error("expected at least 1 opportunity")
	}
	if analysis.Currency != "CNY" {
		t.Errorf("expected CNY, got %s", analysis.Currency)
	}
}

func TestRecommendOptimization(t *testing.T) {
	svc := NewService(nil)
	recs, err := svc.RecommendOptimization("tenant-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(recs) == 0 {
		t.Error("expected at least 1 recommendation")
	}
}

func TestGenerateAlerts(t *testing.T) {
	svc := NewService(nil)
	alerts := svc.GenerateAlerts("tenant-1")
	if len(alerts) == 0 {
		t.Error("expected at least 1 alert")
	}
	for _, a := range alerts {
		if a.Type != "high_savings_opportunity" {
			t.Errorf("expected type 'high_savings_opportunity', got '%s'", a.Type)
		}
	}
}

func TestGetSavingsHistoryNoDB(t *testing.T) {
	// With nil repo, GetSavingsHistory will panic (nil pointer dereference).
	// This test requires a real database connection.
	t.Skip("skipping DB-dependent test: no database connection available")
}
