package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/testutil"
)

func TestWorkflowService_TransitionStatus(t *testing.T) {
	ticketRepo := testutil.NewMockTicketRepository()
	workflowRepo := testutil.NewMockWorkflowRepository()

	ticketRepo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1", Status: "open"}

	svc := NewWorkflowService(workflowRepo, ticketRepo)
	ctx := context.Background()

	ticket, history, err := svc.TransitionStatus(ctx, "t1", "tenant-1", "in-progress", "user-1", "starting work")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ticket.Status != "in-progress" {
		t.Errorf("expected status 'in-progress', got '%s'", ticket.Status)
	}
	if history.FromStatus != "open" {
		t.Errorf("expected from_status 'open', got '%s'", history.FromStatus)
	}
	if history.ToStatus != "in-progress" {
		t.Errorf("expected to_status 'in-progress', got '%s'", history.ToStatus)
	}
	if len(workflowRepo.History) != 1 {
		t.Errorf("expected 1 history entry, got %d", len(workflowRepo.History))
	}
}

func TestWorkflowService_TransitionStatus_InvalidTransition(t *testing.T) {
	ticketRepo := testutil.NewMockTicketRepository()
	workflowRepo := testutil.NewMockWorkflowRepository()

	ticketRepo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1", Status: "closed"}

	svc := NewWorkflowService(workflowRepo, ticketRepo)
	ctx := context.Background()

	// closed -> resolved is not valid (closed can only go to open)
	_, _, err := svc.TransitionStatus(ctx, "t1", "tenant-1", "resolved", "user-1", "")
	if err == nil {
		t.Error("expected error for invalid transition closed -> resolved")
	}
}

func TestWorkflowService_TransitionStatus_TicketNotFound(t *testing.T) {
	ticketRepo := testutil.NewMockTicketRepository()
	workflowRepo := testutil.NewMockWorkflowRepository()

	svc := NewWorkflowService(workflowRepo, ticketRepo)
	ctx := context.Background()

	_, _, err := svc.TransitionStatus(ctx, "nonexistent", "tenant-1", "in-progress", "user-1", "")
	if err == nil {
		t.Error("expected error for nonexistent ticket")
	}
}

func TestWorkflowService_GetWorkflowHistory(t *testing.T) {
	ticketRepo := testutil.NewMockTicketRepository()
	workflowRepo := testutil.NewMockWorkflowRepository()

	workflowRepo.History = []models.WorkflowHistory{
		{ID: "h1", TicketID: "t1", FromStatus: "", ToStatus: "open"},
		{ID: "h2", TicketID: "t1", FromStatus: "open", ToStatus: "in-progress"},
		{ID: "h3", TicketID: "t2", FromStatus: "", ToStatus: "open"},
	}

	svc := NewWorkflowService(workflowRepo, ticketRepo)
	ctx := context.Background()

	history, err := svc.GetWorkflowHistory(ctx, "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(history) != 2 {
		t.Errorf("expected 2 history entries, got %d", len(history))
	}
}

func TestWorkflowService_TransitionStatus_FullLifecycle(t *testing.T) {
	ticketRepo := testutil.NewMockTicketRepository()
	workflowRepo := testutil.NewMockWorkflowRepository()

	ticketRepo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1", Status: "open"}

	svc := NewWorkflowService(workflowRepo, ticketRepo)
	ctx := context.Background()

	// open -> in-progress
	_, _, err := svc.TransitionStatus(ctx, "t1", "tenant-1", "in-progress", "u1", "")
	if err != nil {
		t.Fatalf("open->in-progress: %v", err)
	}

	// in-progress -> resolved
	_, _, err = svc.TransitionStatus(ctx, "t1", "tenant-1", "resolved", "u1", "")
	if err != nil {
		t.Fatalf("in-progress->resolved: %v", err)
	}

	// resolved -> closed
	_, _, err = svc.TransitionStatus(ctx, "t1", "tenant-1", "closed", "u1", "")
	if err != nil {
		t.Fatalf("resolved->closed: %v", err)
	}

	if len(workflowRepo.History) != 3 {
		t.Errorf("expected 3 history entries, got %d", len(workflowRepo.History))
	}
}
