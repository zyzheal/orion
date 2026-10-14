package monitor

import (
	"testing"
	"time"

	"orion/platform-svc-go/internal/alert-sla/models"
)

func TestEvaluateSLA_NoBreach(t *testing.T) {
	sla := models.AlertSLA{
		ID:           "sla1",
		TenantID:     "t1",
		Severity:     "critical",
		ResponseTime: 300,
		ResolveTime:  3600,
		Enabled:      true,
	}
	now := time.Date(2026, 1, 1, 12, 5, 0, 0, time.UTC)
	alert := ActiveAlert{
		ID:        "a1",
		TenantID:  "t1",
		Severity:  "critical",
		CreatedAt: now.Add(-60 * time.Second), // 1 min ago
	}
	breaches := EvaluateSLA(sla, alert, now)
	if len(breaches) != 0 {
		t.Errorf("expected 0 breaches, got %d", len(breaches))
	}
}

func TestEvaluateSLA_ResponseBreach(t *testing.T) {
	sla := models.AlertSLA{
		ID:           "sla1",
		TenantID:     "t1",
		Severity:     "critical",
		ResponseTime: 300,
		ResolveTime:  3600,
		Enabled:      true,
	}
	now := time.Date(2026, 1, 1, 12, 10, 0, 0, time.UTC)
	alert := ActiveAlert{
		ID:        "a1",
		TenantID:  "t1",
		Severity:  "critical",
		CreatedAt: now.Add(-400 * time.Second), // 6m40s ago, > 5min response
	}
	breaches := EvaluateSLA(sla, alert, now)
	if len(breaches) != 1 {
		t.Fatalf("expected 1 breach, got %d", len(breaches))
	}
	if breaches[0].BreachType != "response" {
		t.Errorf("expected response breach, got %s", breaches[0].BreachType)
	}
	if breaches[0].ElapsedSec <= 300 {
		t.Errorf("expected elapsed > 300, got %d", breaches[0].ElapsedSec)
	}
}

func TestEvaluateSLA_ResolveBreach(t *testing.T) {
	sla := models.AlertSLA{
		ID:           "sla1",
		TenantID:     "t1",
		Severity:     "critical",
		ResponseTime: 300,
		ResolveTime:  3600,
		Enabled:      true,
	}
	now := time.Date(2026, 1, 1, 13, 10, 0, 0, time.UTC) // 70 min later
	acked := now.Add(-65 * 60 * time.Second) // acked 5 min after creation
	alert := ActiveAlert{
		ID:        "a1",
		TenantID:  "t1",
		Severity:  "critical",
		CreatedAt: now.Add(-70 * 60 * time.Second), // 70 min ago
		AckedAt:   &acked,                          // acknowledged, so no response breach
	}
	breaches := EvaluateSLA(sla, alert, now)
	if len(breaches) != 1 {
		t.Fatalf("expected 1 breach, got %d", len(breaches))
	}
	if breaches[0].BreachType != "resolve" {
		t.Errorf("expected resolve breach, got %s", breaches[0].BreachType)
	}
}

func TestEvaluateSLA_BothBreaches(t *testing.T) {
	sla := models.AlertSLA{
		ID:           "sla1",
		TenantID:     "t1",
		Severity:     "critical",
		ResponseTime: 300,
		ResolveTime:  3600,
		Enabled:      true,
	}
	now := time.Date(2026, 1, 1, 13, 10, 0, 0, time.UTC)
	alert := ActiveAlert{
		ID:        "a1",
		TenantID:  "t1",
		Severity:  "critical",
		CreatedAt: now.Add(-70 * 60 * time.Second), // 70 min ago, > both
	}
	breaches := EvaluateSLA(sla, alert, now)
	if len(breaches) != 2 {
		t.Fatalf("expected 2 breaches, got %d", len(breaches))
	}
}

func TestEvaluateSLA_DisabledSLA(t *testing.T) {
	sla := models.AlertSLA{
		ID:           "sla1",
		TenantID:     "t1",
		Severity:     "critical",
		ResponseTime: 300,
		ResolveTime:  3600,
		Enabled:      false,
	}
	now := time.Date(2026, 1, 1, 13, 10, 0, 0, time.UTC)
	alert := ActiveAlert{
		ID:        "a1",
		TenantID:  "t1",
		Severity:  "critical",
		CreatedAt: now.Add(-70 * 60 * time.Second),
	}
	breaches := EvaluateSLA(sla, alert, now)
	if len(breaches) != 0 {
		t.Errorf("expected 0 breaches for disabled SLA, got %d", len(breaches))
	}
}

func TestEvaluateSLA_ResolvedNoBreach(t *testing.T) {
	sla := models.AlertSLA{
		ID:           "sla1",
		TenantID:     "t1",
		Severity:     "critical",
		ResponseTime: 300,
		ResolveTime:  3600,
		Enabled:      true,
	}
	now := time.Date(2026, 1, 1, 12, 10, 0, 0, time.UTC)
	acked := now.Add(-60 * time.Second)
	resolved := now.Add(-30 * time.Second)
	alert := ActiveAlert{
		ID:         "a1",
		TenantID:   "t1",
		Severity:   "critical",
		CreatedAt:  now.Add(-300 * time.Second), // 5 min ago
		AckedAt:    &acked,
		ResolvedAt: &resolved,
	}
	breaches := EvaluateSLA(sla, alert, now)
	if len(breaches) != 0 {
		t.Errorf("expected 0 breaches for resolved alert, got %d", len(breaches))
	}
}
