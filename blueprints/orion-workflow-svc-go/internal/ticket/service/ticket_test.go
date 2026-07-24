package service

import (
	"context"
	"testing"

	"orion/workflow-svc-go/internal/ticket/models"
	"orion/workflow-svc-go/internal/ticket/testutil"
)

func newTestTicketService() (*TicketService, *testutil.MockTicketRepository, *testutil.MockCommentRepository) {
	ticketRepo := testutil.NewMockTicketRepository()
	commentRepo := testutil.NewMockCommentRepository()
	workflowRepo := testutil.NewMockWorkflowRepository()
	slaRepo := testutil.NewMockSLARepository()
	dispatchRepo := testutil.NewMockDispatchRepository()
	relationRepo := testutil.NewMockRelationRepository()
	ruleRepo := testutil.NewMockAssignmentRuleRepository()

	workflowSvc := NewWorkflowService(workflowRepo, ticketRepo)
	slaSvc := NewSLAService(slaRepo, ticketRepo)
	dispatchSvc := NewDispatchService(dispatchRepo, ticketRepo, slaRepo)
	analyzerSvc := NewAnalyzerService(relationRepo, ticketRepo)

	svc := NewTicketService(ticketRepo, commentRepo, workflowSvc, slaSvc, dispatchSvc, analyzerSvc, ruleRepo)
	return svc, ticketRepo, commentRepo
}

func TestTicketService_Create(t *testing.T) {
	svc, repo, _ := newTestTicketService()
	ctx := context.Background()

	req := &models.CreateTicketRequest{
		Title:       "Test Ticket",
		Description: "Test Description",
		Type:        "bug",
		Priority:    "high",
	}

	ticket, err := svc.Create(ctx, "tenant-1", req, "user-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ticket.Title != "Test Ticket" {
		t.Errorf("expected title 'Test Ticket', got '%s'", ticket.Title)
	}
	if ticket.Status != models.StatusOpen {
		t.Errorf("expected status '%s', got '%s'", models.StatusOpen, ticket.Status)
	}
	if ticket.TenantID != "tenant-1" {
		t.Errorf("expected tenant_id 'tenant-1', got '%s'", ticket.TenantID)
	}
	if ticket.CreatedBy != "user-1" {
		t.Errorf("expected created_by 'user-1', got '%s'", ticket.CreatedBy)
	}
	if _, ok := repo.Tickets[ticket.ID]; !ok {
		t.Error("ticket not stored in repository")
	}
}

func TestTicketService_Create_WithAssignmentRule(t *testing.T) {
	ticketRepo := testutil.NewMockTicketRepository()
	commentRepo := testutil.NewMockCommentRepository()
	workflowRepo := testutil.NewMockWorkflowRepository()
	slaRepo := testutil.NewMockSLARepository()
	dispatchRepo := testutil.NewMockDispatchRepository()
	relationRepo := testutil.NewMockRelationRepository()
	ruleRepo := testutil.NewMockAssignmentRuleRepository()

	// Add a matching rule
	ruleRepo.Rules = []models.AssignmentRule{
		{ID: "rule-1", Name: "Bug Rule", Categories: []string{"bug"}, Assignee: "engineer-1", Priorities: []string{"high"}, Enabled: true, Order: 1},
	}

	workflowSvc := NewWorkflowService(workflowRepo, ticketRepo)
	slaSvc := NewSLAService(slaRepo, ticketRepo)
	dispatchSvc := NewDispatchService(dispatchRepo, ticketRepo, slaRepo)
	analyzerSvc := NewAnalyzerService(relationRepo, ticketRepo)
	svc := NewTicketService(ticketRepo, commentRepo, workflowSvc, slaSvc, dispatchSvc, analyzerSvc, ruleRepo)

	ctx := context.Background()
	req := &models.CreateTicketRequest{Title: "Bug", Type: "bug", Priority: "high"}

	ticket, err := svc.Create(ctx, "tenant-1", req, "user-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ticket.AssignedTo != "engineer-1" {
		t.Errorf("expected assigned_to 'engineer-1', got '%s'", ticket.AssignedTo)
	}
	if ticket.Status != models.StatusAssigned {
		t.Errorf("expected status '%s', got '%s'", models.StatusAssigned, ticket.Status)
	}
}

func TestTicketService_GetByID(t *testing.T) {
	svc, repo, _ := newTestTicketService()
	ctx := context.Background()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1", Title: "Test"}

	ticket, err := svc.GetByID(ctx, "t1", "tenant-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ticket.ID != "t1" {
		t.Errorf("expected ID 't1', got '%s'", ticket.ID)
	}
}

func TestTicketService_GetByID_NotFound(t *testing.T) {
	svc, _, _ := newTestTicketService()
	ctx := context.Background()

	_, err := svc.GetByID(ctx, "nonexistent", "tenant-1")
	if err == nil {
		t.Error("expected error for nonexistent ticket")
	}
}

func TestTicketService_List(t *testing.T) {
	svc, repo, _ := newTestTicketService()
	ctx := context.Background()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1", Title: "A"}
	repo.Tickets["t2"] = &models.Ticket{ID: "t2", TenantID: "tenant-1", Title: "B"}
	repo.Tickets["t3"] = &models.Ticket{ID: "t3", TenantID: "tenant-2", Title: "C"}

	tickets, total, err := svc.List(ctx, "tenant-1", models.ListQuery{Page: 1, PageSize: 10})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 2 {
		t.Errorf("expected total 2, got %d", total)
	}
	if len(tickets) != 2 {
		t.Errorf("expected 2 tickets, got %d", len(tickets))
	}
}

func TestTicketService_Delete(t *testing.T) {
	svc, repo, _ := newTestTicketService()
	ctx := context.Background()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1"}

	err := svc.Delete(ctx, "t1", "tenant-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := repo.Tickets["t1"]; ok {
		t.Error("ticket should have been deleted")
	}
}

func TestTicketService_AddComment(t *testing.T) {
	svc, repo, commentRepo := newTestTicketService()
	ctx := context.Background()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1"}

	req := &models.CreateCommentRequest{Author: "user-1", Content: "Hello"}
	comment, err := svc.AddComment(ctx, "t1", "tenant-1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if comment.Content != "Hello" {
		t.Errorf("expected content 'Hello', got '%s'", comment.Content)
	}
	if len(commentRepo.Comments["t1"]) != 1 {
		t.Errorf("expected 1 comment, got %d", len(commentRepo.Comments["t1"]))
	}
}

func TestTicketService_AddComment_TicketNotFound(t *testing.T) {
	svc, _, _ := newTestTicketService()
	ctx := context.Background()

	req := &models.CreateCommentRequest{Author: "user-1", Content: "Hello"}
	_, err := svc.AddComment(ctx, "nonexistent", "tenant-1", req)
	if err == nil {
		t.Error("expected error for nonexistent ticket")
	}
}

func TestTicketService_Count(t *testing.T) {
	svc, repo, _ := newTestTicketService()
	ctx := context.Background()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1"}
	repo.Tickets["t2"] = &models.Ticket{ID: "t2", TenantID: "tenant-1"}
	repo.Tickets["t3"] = &models.Ticket{ID: "t3", TenantID: "tenant-2"}

	count, err := svc.Count(ctx, "tenant-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if count != 2 {
		t.Errorf("expected count 2, got %d", count)
	}
}

func TestTicketService_Escalate(t *testing.T) {
	svc, repo, _ := newTestTicketService()
	ctx := context.Background()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1", Priority: "low", Status: "open"}

	ticket, err := svc.Escalate(ctx, "t1", "tenant-1", "user-1", "urgent")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ticket.Priority != "medium" {
		t.Errorf("expected priority 'medium', got '%s'", ticket.Priority)
	}
}

func TestTicketService_Escalate_LowToCritical(t *testing.T) {
	svc, repo, _ := newTestTicketService()
	ctx := context.Background()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1", Priority: "high", Status: "open"}

	ticket, err := svc.Escalate(ctx, "t1", "tenant-1", "user-1", "critical issue")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ticket.Priority != "critical" {
		t.Errorf("expected priority 'critical', got '%s'", ticket.Priority)
	}
}

func TestTicketService_Assign(t *testing.T) {
	svc, repo, _ := newTestTicketService()
	ctx := context.Background()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1", Status: "open"}

	err := svc.Assign(ctx, "t1", "tenant-1", "engineer-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.Tickets["t1"].AssignedTo != "engineer-1" {
		t.Errorf("expected assigned_to 'engineer-1', got '%s'", repo.Tickets["t1"].AssignedTo)
	}
}

func TestTicketService_ListComments(t *testing.T) {
	svc, repo, commentRepo := newTestTicketService()
	ctx := context.Background()

	repo.Tickets["t1"] = &models.Ticket{ID: "t1", TenantID: "tenant-1"}
	commentRepo.Comments["t1"] = []models.TicketComment{
		{ID: "c1", TicketID: "t1", Content: "First"},
		{ID: "c2", TicketID: "t1", Content: "Second"},
	}

	comments, err := svc.ListComments(ctx, "t1", "tenant-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(comments) != 2 {
		t.Errorf("expected 2 comments, got %d", len(comments))
	}
}
