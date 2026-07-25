package service

import (
	"context"
	"testing"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/testutil"
)

func newTestDispatchService() (*DispatchService, *testutil.MockDispatchRepository) {
	dispatchRepo := testutil.NewMockDispatchRepository()
	ticketRepo := testutil.NewMockTicketRepository()
	slaRepo := testutil.NewMockSLARepository()
	svc := NewDispatchService(dispatchRepo, ticketRepo, slaRepo)
	return svc, dispatchRepo
}

func TestDispatchService_RegisterEngineer(t *testing.T) {
	svc, repo := newTestDispatchService()
	ctx := context.Background()

	req := &models.RegisterEngineerRequest{
		ID:       "eng-1",
		Name:     "Alice",
		Expertise: []string{"backend", "go"},
		MaxCapacity: 10,
	}

	ep, err := svc.RegisterEngineer(ctx, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ep.Name != "Alice" {
		t.Errorf("expected name 'Alice', got '%s'", ep.Name)
	}
	if ep.Availability != models.AvailabilityAvailable {
		t.Errorf("expected availability '%s', got '%s'", models.AvailabilityAvailable, ep.Availability)
	}
	if len(repo.Engineers) != 1 {
		t.Errorf("expected 1 engineer, got %d", len(repo.Engineers))
	}
}

func TestDispatchService_ListEngineers(t *testing.T) {
	svc, repo := newTestDispatchService()
	ctx := context.Background()

	repo.Engineers = []models.EngineerProfile{
		{ID: "eng-1", Name: "Alice"},
		{ID: "eng-2", Name: "Bob"},
	}

	engineers, err := svc.ListEngineers(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(engineers) != 2 {
		t.Errorf("expected 2 engineers, got %d", len(engineers))
	}
}

func TestDispatchService_GetEngineer(t *testing.T) {
	svc, repo := newTestDispatchService()
	ctx := context.Background()

	repo.Engineers = []models.EngineerProfile{
		{ID: "eng-1", Name: "Alice"},
	}

	ep, err := svc.GetEngineer(ctx, "eng-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ep.Name != "Alice" {
		t.Errorf("expected name 'Alice', got '%s'", ep.Name)
	}
}

func TestDispatchService_GetEngineer_NotFound(t *testing.T) {
	svc, _ := newTestDispatchService()
	ctx := context.Background()

	_, err := svc.GetEngineer(ctx, "nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent engineer")
	}
}

func TestDispatchService_ManualDispatch(t *testing.T) {
	svc, repo := newTestDispatchService()
	ctx := context.Background()

	repo.Engineers = []models.EngineerProfile{
		{ID: "eng-1", Name: "Alice", CurrentLoad: 0, MaxCapacity: 10, Availability: "available"},
	}

	ticketRepo := testutil.NewMockTicketRepository()
	ticketRepo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1"}
	svc.ticketRepo = ticketRepo

	record, err := svc.ManualDispatch(ctx, "t1", "tenant-1", "eng-1", "admin", "manual assignment")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if record.EngineerID != "eng-1" {
		t.Errorf("expected engineer_id 'eng-1', got '%s'", record.EngineerID)
	}
	if repo.Engineers[0].CurrentLoad != 1 {
		t.Errorf("expected load 1, got %d", repo.Engineers[0].CurrentLoad)
	}
	if len(repo.Records) != 1 {
		t.Errorf("expected 1 dispatch record, got %d", len(repo.Records))
	}
}

func TestDispatchService_AddRule(t *testing.T) {
	svc, repo := newTestDispatchService()
	ctx := context.Background()

	rule := &models.DispatchRule{
		ID:         "rule-1",
		Name:       "Backend Rule",
		Condition:  "type == 'backend'",
		EngineerID: "eng-1",
		Priority:   10,
	}

	err := svc.AddRule(ctx, rule)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(repo.Rules) != 1 {
		t.Errorf("expected 1 rule, got %d", len(repo.Rules))
	}
}

func TestDispatchService_RemoveRule(t *testing.T) {
	svc, repo := newTestDispatchService()
	ctx := context.Background()

	repo.Rules = []models.DispatchRule{
		{ID: "rule-1", Name: "Test"},
	}

	err := svc.RemoveRule(ctx, "rule-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(repo.Rules) != 0 {
		t.Errorf("expected 0 rules, got %d", len(repo.Rules))
	}
}

func TestDispatchService_RemoveRule_NotFound(t *testing.T) {
	svc, _ := newTestDispatchService()
	ctx := context.Background()

	err := svc.RemoveRule(ctx, "nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent rule")
	}
}

func TestDispatchService_GetQueueStatus(t *testing.T) {
	svc, _ := newTestDispatchService()
	ctx := context.Background()

	status, err := svc.GetQueueStatus(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.PendingCount != 0 {
		t.Errorf("expected 0 pending, got %d", status.PendingCount)
	}
}

func TestDispatchService_UpdateWeights(t *testing.T) {
	svc, _ := newTestDispatchService()

	w := models.DispatchWeights{
		Expertise:    0.4,
		Workload:     0.2,
		Availability: 0.2,
		SuccessRate:  0.1,
		SLAUrgency:   0.1,
	}

	svc.UpdateWeights(w)

	got := svc.GetWeights()
	if got.Expertise != 0.4 {
		t.Errorf("expected expertise 0.4, got %f", got.Expertise)
	}
	if got.Workload != 0.2 {
		t.Errorf("expected workload 0.2, got %f", got.Workload)
	}
}

func TestDispatchService_GetLoadBalanceReport(t *testing.T) {
	svc, repo := newTestDispatchService()
	ctx := context.Background()

	repo.Engineers = []models.EngineerProfile{
		{ID: "eng-1", Name: "Alice", CurrentLoad: 3, MaxCapacity: 10},
		{ID: "eng-2", Name: "Bob", CurrentLoad: 8, MaxCapacity: 10},
	}

	report, err := svc.GetLoadBalanceReport(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(report.Engineers) != 2 {
		t.Errorf("expected 2 engineers in report, got %d", len(report.Engineers))
	}
}

func TestDispatchService_GetAllPerformances(t *testing.T) {
	svc, repo := newTestDispatchService()
	ctx := context.Background()

	repo.Engineers = []models.EngineerProfile{
		{ID: "eng-1", Name: "Alice", TotalResolved: 50, SuccessRate: 0.95},
		{ID: "eng-2", Name: "Bob", TotalResolved: 30, SuccessRate: 0.88},
	}

	perfs, err := svc.GetAllPerformances(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(perfs) != 2 {
		t.Errorf("expected 2 performances, got %d", len(perfs))
	}
}

func TestDispatchService_GetMetrics(t *testing.T) {
	svc, repo := newTestDispatchService()
	ctx := context.Background()

	repo.Records = []models.DispatchRecord{
		{ID: "r1", Method: "auto"},
		{ID: "r2", Method: "manual"},
		{ID: "r3", Method: "auto"},
	}

	now := time.Now()
	metrics, err := svc.GetMetrics(ctx, now.AddDate(0, -1, 0), now)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if metrics.TotalDispatches != 3 {
		t.Errorf("expected 3 total, got %d", metrics.TotalDispatches)
	}
	if metrics.AutoDispatches != 2 {
		t.Errorf("expected 2 auto, got %d", metrics.AutoDispatches)
	}
	if metrics.ManualDispatches != 1 {
		t.Errorf("expected 1 manual, got %d", metrics.ManualDispatches)
	}
}

func TestDispatchService_GetRules(t *testing.T) {
	svc, repo := newTestDispatchService()
	ctx := context.Background()

	repo.Rules = []models.DispatchRule{
		{ID: "rule-1", Name: "A"},
		{ID: "rule-2", Name: "B"},
	}

	rules, err := svc.GetRules(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(rules) != 2 {
		t.Errorf("expected 2 rules, got %d", len(rules))
	}
}
