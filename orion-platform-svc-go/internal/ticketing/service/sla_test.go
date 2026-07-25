package service

import (
	"context"
	"testing"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/testutil"
)

func TestSLAService_CreateTarget(t *testing.T) {
	slaRepo := testutil.NewMockSLARepository()
	ticketRepo := testutil.NewMockTicketRepository()
	svc := NewSLAService(slaRepo, ticketRepo)
	ctx := context.Background()

	req := &models.CreateSLATargetRequest{
		ID:                     "sla-high",
		Name:                   "High Priority SLA",
		Priority:               "high",
		TargetResponseTimeMs:   3600000,
		TargetResolutionTimeMs: 86400000,
	}

	target, err := svc.CreateTarget(ctx, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if target.Name != "High Priority SLA" {
		t.Errorf("expected name 'High Priority SLA', got '%s'", target.Name)
	}
	if len(slaRepo.Targets) != 1 {
		t.Errorf("expected 1 target, got %d", len(slaRepo.Targets))
	}
}

func TestSLAService_CreateRecordForTicket(t *testing.T) {
	slaRepo := testutil.NewMockSLARepository()
	ticketRepo := testutil.NewMockTicketRepository()
	svc := NewSLAService(slaRepo, ticketRepo)
	ctx := context.Background()

	// Add a target first
	slaRepo.Targets = []models.SLATarget{
		{ID: "sla-high", Priority: "high", TargetResponseTimeMs: 3600000, TargetResolutionTimeMs: 86400000, Enabled: true},
	}

	err := svc.CreateRecordForTicket(ctx, "t1", "high")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(slaRepo.Records) != 1 {
		t.Errorf("expected 1 record, got %d", len(slaRepo.Records))
	}
	if slaRepo.Records[0].TicketID != "t1" {
		t.Errorf("expected ticket_id 't1', got '%s'", slaRepo.Records[0].TicketID)
	}
}

func TestSLAService_CreateRecordForTicket_NoTarget(t *testing.T) {
	slaRepo := testutil.NewMockSLARepository()
	ticketRepo := testutil.NewMockTicketRepository()
	svc := NewSLAService(slaRepo, ticketRepo)
	ctx := context.Background()

	// No targets - should skip silently
	err := svc.CreateRecordForTicket(ctx, "t1", "high")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(slaRepo.Records) != 0 {
		t.Errorf("expected 0 records, got %d", len(slaRepo.Records))
	}
}

func TestSLAService_CheckBreaches(t *testing.T) {
	slaRepo := testutil.NewMockSLARepository()
	ticketRepo := testutil.NewMockTicketRepository()
	svc := NewSLAService(slaRepo, ticketRepo)
	ctx := context.Background()

	pastDeadline := time.Now().Add(-1 * time.Hour)
	slaRepo.Records = []models.SLARecord{
		{ID: "r1", TicketID: "t1", Breached: false, ResolutionDeadlineAt: pastDeadline},
		{ID: "r2", TicketID: "t2", Breached: false, ResolutionDeadlineAt: pastDeadline},
		{ID: "r3", TicketID: "t3", Breached: true},  // already breached, skipped by FindPendingRecords
	}

	breaches, err := svc.CheckBreaches(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(breaches) != 2 {
		t.Errorf("expected 2 breaches, got %d", len(breaches))
	}
}

func TestSLAService_GetComplianceReport(t *testing.T) {
	slaRepo := testutil.NewMockSLARepository()
	ticketRepo := testutil.NewMockTicketRepository()
	svc := NewSLAService(slaRepo, ticketRepo)
	ctx := context.Background()

	slaRepo.Records = []models.SLARecord{
		{ID: "r1", TicketID: "t1", Breached: false},
		{ID: "r2", TicketID: "t2", Breached: true},
		{ID: "r3", TicketID: "t3", Breached: false},
	}

	now := time.Now()
	report, err := svc.GetComplianceReport(ctx, now.AddDate(0, -1, 0), now)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if report.TotalTickets != 3 {
		t.Errorf("expected 3 total, got %d", report.TotalTickets)
	}
	if report.BreachedCount != 1 {
		t.Errorf("expected 1 breached, got %d", report.BreachedCount)
	}
}

func TestSLAService_PauseUnpause(t *testing.T) {
	slaRepo := testutil.NewMockSLARepository()
	ticketRepo := testutil.NewMockTicketRepository()
	svc := NewSLAService(slaRepo, ticketRepo)
	ctx := context.Background()

	slaRepo.Records = []models.SLARecord{
		{ID: "r1", TicketID: "t1", Breached: false, Paused: false},
	}

	err := svc.PauseSLA(ctx, "t1", "waiting for info")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !slaRepo.Records[0].Paused {
		t.Error("expected record to be paused")
	}

	err = svc.UnpauseSLA(ctx, "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if slaRepo.Records[0].Paused {
		t.Error("expected record to be unpaused")
	}
}
