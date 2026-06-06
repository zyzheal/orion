package service

import (
	"context"
	"fmt"

	"orion-ticket-svc-go/internal/models"
	"orion-ticket-svc-go/internal/otel"
	"orion-ticket-svc-go/internal/repository"

	"github.com/google/uuid"
)

type TicketService struct {
	repo      *repository.TicketRepository
	comment   *repository.CommentRepository
	workflow  *WorkflowService
	sla       *SLAService
	dispatch  *DispatchService
	analyzer  *AnalyzerService
	ruleRepo  *repository.AssignmentRuleRepository
}

func NewTicketService(
	repo *repository.TicketRepository,
	comment *repository.CommentRepository,
	workflow *WorkflowService,
	sla *SLAService,
	dispatch *DispatchService,
	analyzer *AnalyzerService,
	ruleRepo *repository.AssignmentRuleRepository,
) *TicketService {
	return &TicketService{
		repo:     repo,
		comment:  comment,
		workflow: workflow,
		sla:      sla,
		dispatch: dispatch,
		analyzer: analyzer,
		ruleRepo: ruleRepo,
	}
}

func (s *TicketService) Create(ctx context.Context, tenantID string, req *models.CreateTicketRequest, createdBy string) (*models.Ticket, error) {
	_, span := otel.Tracer().Start(ctx, "TicketService.Create")
	defer span.End()

	ticket := &models.Ticket{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Title:       req.Title,
		Description: req.Description,
		Type:        req.Type,
		Priority:    req.Priority,
		Status:      models.StatusOpen,
		CreatedBy:   createdBy,
	}

	if err := s.repo.Create(ticket); err != nil {
		return nil, err
	}

	// Record workflow entry for initial status
	if s.workflow != nil {
		s.workflow.workflowRepo.Create(&models.WorkflowHistory{
			ID:         uuid.New().String(),
			TicketID:   ticket.ID,
			FromStatus: "",
			ToStatus:   models.StatusOpen,
			PerformedBy: createdBy,
		})
	}

	// Create SLA record
	if s.sla != nil {
		s.sla.CreateRecordForTicket(ctx, ticket.ID, ticket.Priority)
	}

	// Check assignment rules
	if s.ruleRepo != nil {
		rule, _ := s.ruleRepo.FindMatching(ticket.Type, ticket.Priority)
		if rule != nil {
			s.repo.UpdateAssignee(ticket.ID, tenantID, rule.Assignee)
			s.repo.UpdateStatus(ticket.ID, tenantID, models.StatusAssigned)
			ticket.AssignedTo = rule.Assignee
			ticket.Status = models.StatusAssigned
		}
	}

	return ticket, nil
}

func (s *TicketService) GetByID(ctx context.Context, id, tenantID string) (*models.Ticket, error) {
	_, span := otel.Tracer().Start(ctx, "TicketService.GetByID")
	defer span.End()
	return s.repo.GetByID(id, tenantID)
}

func (s *TicketService) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.Ticket, int, error) {
	_, span := otel.Tracer().Start(ctx, "TicketService.List")
	defer span.End()

	if q.Page <= 0 {
		q.Page = 1
	}
	if q.PageSize <= 0 {
		q.PageSize = 20
	}
	return s.repo.List(tenantID, q)
}

func (s *TicketService) Update(ctx context.Context, ticket *models.Ticket) error {
	_, span := otel.Tracer().Start(ctx, "TicketService.Update")
	defer span.End()
	return s.repo.Update(ticket)
}

func (s *TicketService) Delete(ctx context.Context, id, tenantID string) error {
	_, span := otel.Tracer().Start(ctx, "TicketService.Delete")
	defer span.End()
	return s.repo.Delete(id, tenantID)
}

func (s *TicketService) Resolve(ctx context.Context, id, tenantID, performedBy string) error {
	_, span := otel.Tracer().Start(ctx, "TicketService.Resolve")
	defer span.End()

	if s.workflow != nil {
		_, _, err := s.workflow.TransitionStatus(ctx, id, tenantID, models.StatusResolved, performedBy, "")
		return err
	}
	return s.repo.UpdateStatus(id, tenantID, "resolved")
}

func (s *TicketService) Assign(ctx context.Context, id, tenantID, assignedTo string) error {
	_, span := otel.Tracer().Start(ctx, "TicketService.Assign")
	defer span.End()

	if err := s.repo.UpdateAssignee(id, tenantID, assignedTo); err != nil {
		return err
	}

	// Transition to assigned status
	if s.workflow != nil {
		s.workflow.TransitionStatus(ctx, id, tenantID, models.StatusAssigned, "system", "auto-assigned")
	}

	return nil
}

func (s *TicketService) TransitionStatus(ctx context.Context, ticketID, tenantID, toStatus, performedBy, reason string) (*models.Ticket, *models.WorkflowHistory, error) {
	if s.workflow == nil {
		return nil, nil, fmt.Errorf("workflow service not configured")
	}
	return s.workflow.TransitionStatus(ctx, ticketID, tenantID, toStatus, performedBy, reason)
}

func (s *TicketService) GetWorkflowHistory(ctx context.Context, ticketID string) ([]models.WorkflowHistory, error) {
	if s.workflow == nil {
		return nil, nil
	}
	return s.workflow.GetWorkflowHistory(ctx, ticketID)
}

func (s *TicketService) AddComment(ctx context.Context, ticketID, tenantID string, req *models.CreateCommentRequest) (*models.TicketComment, error) {
	_, span := otel.Tracer().Start(ctx, "TicketService.AddComment")
	defer span.End()

	if _, err := s.repo.GetByID(ticketID, tenantID); err != nil {
		return nil, err
	}

	comment := &models.TicketComment{
		ID:         uuid.New().String(),
		TicketID:   ticketID,
		Author:     req.Author,
		Content:    req.Content,
		IsInternal: req.IsInternal,
	}

	if err := s.comment.Create(comment); err != nil {
		return nil, err
	}
	return comment, nil
}

func (s *TicketService) ListComments(ctx context.Context, ticketID, tenantID string) ([]models.TicketComment, error) {
	_, span := otel.Tracer().Start(ctx, "TicketService.ListComments")
	defer span.End()

	if _, err := s.repo.GetByID(ticketID, tenantID); err != nil {
		return nil, err
	}
	return s.comment.ListByTicket(ticketID)
}

func (s *TicketService) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// Escalate escalates a ticket's priority
func (s *TicketService) Escalate(ctx context.Context, ticketID, tenantID, escalatedBy, reason string) (*models.Ticket, error) {
	ticket, err := s.repo.GetByID(ticketID, tenantID)
	if err != nil {
		return nil, err
	}

	// Escalate priority
	switch ticket.Priority {
	case "low":
		ticket.Priority = "medium"
	case "medium":
		ticket.Priority = "high"
	case "high":
		ticket.Priority = "critical"
	}

	if err := s.repo.Update(ticket); err != nil {
		return nil, err
	}

	// Record in workflow
	if s.workflow != nil {
		s.workflow.workflowRepo.Create(&models.WorkflowHistory{
			ID:          uuid.New().String(),
			TicketID:    ticketID,
			FromStatus:  ticket.Status,
			ToStatus:    ticket.Status,
			PerformedBy: escalatedBy,
			Reason:      "escalated: " + reason,
		})
	}

	return ticket, nil
}

// Close closes a ticket
func (s *TicketService) Close(ctx context.Context, ticketID, tenantID, performedBy, reason string) (*models.Ticket, error) {
	if s.workflow != nil {
		ticket, _, err := s.workflow.TransitionStatus(ctx, ticketID, tenantID, models.StatusClosed, performedBy, reason)
		return ticket, err
	}

	if err := s.repo.UpdateStatus(ticketID, tenantID, "closed"); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ticketID, tenantID)
}
