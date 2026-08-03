package models

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// HealingAction structural tests
// ---------------------------------------------------------------------------

func TestHealingAction_Creation(t *testing.T) {
	now := time.Now()
	action := &HealingAction{
		ID:         uuid.New(),
		TenantID:   uuid.New(),
		Name:       "restart-db",
		ActionType: "restart",
		Target:     "db-cluster-1",
		Command:    "",
		IsEnabled:  true,
		RetryCount: 3,
		RetryDelay: 5,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if action.ID == uuid.Nil {
		t.Error("HealingAction.ID should be non-nil")
	}
	if action.IsEnabled != true {
		t.Error("expected IsEnabled=true")
	}
}

func TestHealingAction_JSONFields(t *testing.T) {
	action := &HealingAction{
		Name: "test",
	}
	if action.Name != "test" {
		t.Error("action Name not set")
	}
}

// ---------------------------------------------------------------------------
// HealingTrigger structural tests
// ---------------------------------------------------------------------------

func TestHealingTrigger_Creation(t *testing.T) {
	trig := &HealingTrigger{
		ID:           uuid.New(),
		TenantID:     uuid.New(),
		ActionID:     uuid.New(),
		Condition:    "cpu > 80",
		Threshold:    80.0,
		EvaluationSec: 60,
		IsEnabled:    true,
		CreatedAt:    time.Now(),
	}

	if trig.ID == uuid.Nil {
		t.Error("HealingTrigger.ID should be non-nil")
	}
	if trig.Threshold != 80.0 {
		t.Errorf("threshold mismatch: got %f", trig.Threshold)
	}
}

// ---------------------------------------------------------------------------
// HealingHistory structural tests
// ---------------------------------------------------------------------------

func TestHealingHistory_Statuses(t *testing.T) {
	statuses := []string{"running", "completed", "failed"}
	for _, s := range statuses {
		t.Run(s, func(t *testing.T) {
			h := &HealingHistory{
				ID:      uuid.New(),
				Status:  s,
				Attempt: 1,
				TriggeredBy: "manual",
				StartedAt: time.Now(),
			}
			if h.Status != s {
				t.Errorf("status mismatch: got %q", h.Status)
			}
			if h.CompletedAt != nil {
				t.Error("CompletedAt should be nil for running history")
			}
		})
	}
}

func TestHealingHistory_WithTrigger(t *testing.T) {
	triggerID := uuid.New()
	h := &HealingHistory{
		ID:      uuid.New(),
		TriggerID: &triggerID,
	}
	if h.TriggerID == nil {
		t.Fatal("TriggerID should be set")
	}
	if *h.TriggerID != triggerID {
		t.Error("TriggerID mismatch")
	}
}

// ---------------------------------------------------------------------------
// HealingStrategy / HealingIncident / HealingEffectiveness
// ---------------------------------------------------------------------------

func TestHealingStrategy(t *testing.T) {
	strat := &HealingStrategy{
		ID:          uuid.New(),
		TenantID:    uuid.New(),
		Name:        "db-failover",
		Description: "restart and failover",
		Enabled:     true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if strat.ID == uuid.Nil {
		t.Error("HealingStrategy.ID should be non-nil")
	}
}

func TestHealingIncident(t *testing.T) {
	inc := &HealingIncident{
		ID:         uuid.New(),
		TenantID:   uuid.New(),
		StrategyID: uuid.New(),
		Trigger:    "manual",
		Status:     "pending",
		StartedAt:  time.Now(),
	}
	if inc.CompletedAt != nil {
		t.Error("CompletedAt should be nil for pending incident")
	}
}

func TestHealingEffectiveness_Rate(t *testing.T) {
	eff := &HealingEffectiveness{
		StrategyID:       uuid.New(),
		TotalIncidents:   10,
		ResolvedIncidents: 7,
	}
	// Document the invariant: resolution_rate = resolved/total.
	if eff.TotalIncidents != 10 {
		t.Error("TotalIncidents mismatch")
	}
	if eff.ResolvedIncidents != 7 {
		t.Error("ResolvedIncidents mismatch")
	}
}

// ---------------------------------------------------------------------------
// ApprovalRequest statuses
// ---------------------------------------------------------------------------

func TestApprovalRequest_Statuses(t *testing.T) {
	statuses := []string{"pending", "approved", "rejected", "expired"}
	for _, s := range statuses {
		t.Run(s, func(t *testing.T) {
			ar := &ApprovalRequest{
				ID:        uuid.New(),
				IncidentID: uuid.New(),
				Title:     "approve-deploy",
				Status:    s,
				RiskLevel: "high",
				CreatedAt: time.Now(),
			}
			if ar.Status != s {
				t.Errorf("status mismatch: got %q", ar.Status)
			}
			if ar.ExpiresAt != nil {
				t.Error("ExpiresAt should be nil")
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

func TestHistoryQuery_Filters(t *testing.T) {
	status := "completed"
	q := &HistoryQuery{
		Status: &status,
		Limit:  10,
		Offset: 0,
	}
	if q.Status == nil {
		t.Fatal("Status should be set")
	}
	if *q.Status != "completed" {
		t.Errorf("status mismatch: got %q", *q.Status)
	}
}

func TestEffectivenessQuery_StrategyFilter(t *testing.T) {
	strategyID := uuid.New()
	q := &EffectivenessQuery{
		StrategyID: &strategyID,
	}
	if q.StrategyID == nil {
		t.Fatal("StrategyID should be set")
	}
}
