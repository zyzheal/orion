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

	ticket, history, err := svc.TransitionStatus(ctx, "t1", "tenant-1", "in_progress", "user-1", "starting work")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ticket.Status != "in_progress" {
		t.Errorf("expected status 'in-progress', got '%s'", ticket.Status)
	}
	if history.FromState != "open" {
		t.Errorf("expected from_status 'open', got '%s'", history.FromState)
	}
	if history.ToState != "in_progress" {
		t.Errorf("expected to_status 'in-progress', got '%s'", history.ToState)
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
	_, _, err := svc.TransitionStatus(ctx, "t1", "tenant-1", "closed", "user-1", "")
	if err == nil {
		t.Error("expected error for invalid transition closed -> resolved")
	}
}

func TestWorkflowService_TransitionStatus_TicketNotFound(t *testing.T) {
	ticketRepo := testutil.NewMockTicketRepository()
	workflowRepo := testutil.NewMockWorkflowRepository()

	svc := NewWorkflowService(workflowRepo, ticketRepo)
	ctx := context.Background()

	_, _, err := svc.TransitionStatus(ctx, "nonexistent", "tenant-1", "in_progress", "user-1", "")
	if err == nil {
		t.Error("expected error for nonexistent ticket")
	}
}

func TestWorkflowService_GetWorkflowHistory(t *testing.T) {
	ticketRepo := testutil.NewMockTicketRepository()
	workflowRepo := testutil.NewMockWorkflowRepository()

	workflowRepo.History = []models.WorkflowHistoryEntry{
		{ID: 1, TicketID: "t1", FromState: "", ToState: "open"},
		{ID: 2, TicketID: "t1", FromState: "open", ToState: "in_progress"},
		{ID: 3, TicketID: "t2", FromState: "", ToState: "open"},
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

	// open -> in_progress
	_, _, err := svc.TransitionStatus(ctx, "t1", "tenant-1", "in_progress", "u1", "")
	if err != nil {
		t.Fatalf("open->in_progress: %v", err)
	}

	// in_progress -> closed
	_, _, err = svc.TransitionStatus(ctx, "t1", "tenant-1", "closed", "u1", "")
	if err != nil {
		t.Fatalf("in_progress->closed: %v", err)
	}

	if len(workflowRepo.History) != 2 {
		t.Errorf("expected 2 history entries, got %d", len(workflowRepo.History))
	}
}
