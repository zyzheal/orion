package service

import (
	"context"
	"fmt"
	"time"

	"orion/go-common/pkg/otel"
	"orion/platform-svc-go/internal/ticket/models"
	"orion/platform-svc-go/internal/ticket/repository"

	"github.com/google/uuid"
)

// TicketService is the ticket CRUD, assignment and resolution layer.
//
// It used to carry a *DispatchService and an *AnalyzerService in fields that no
// method ever read, so both were paid for at wiring time and never used. The
// params are gone; DispatchService and AnalyzerService are reached through
// their own handlers and, for the analyzer, through RelationHandler.
type TicketService struct {
	repo     repository.TicketRepositoryInterface
	comment  repository.CommentRepositoryInterface
	workflow *WorkflowService
	sla      *SLAService
	ruleRepo repository.AssignmentRuleRepositoryInterface
}

func NewTicketService(
	repo repository.TicketRepositoryInterface,
	comment repository.CommentRepositoryInterface,
	workflow *WorkflowService,
	sla *SLAService,
	ruleRepo repository.AssignmentRuleRepositoryInterface,
) *TicketService {
	return &TicketService{
		repo:     repo,
		comment:  comment,
		workflow: workflow,
		sla:      sla,
		ruleRepo: ruleRepo,
	}
}

func (s *TicketService) Create(ctx context.Context, tenantID string, req *models.CreateTicketRequest, createdBy string) (*models.Ticket, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "TicketService.Create")
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

	if err := s.repo.Create(ctx, ticket); err != nil {
		return nil, err
	}

	// Record workflow entry for initial status. Propagated on purpose: this used
	// to be a bare call whose error was thrown away, so a write failure left the
	// ticket in the database with no "create" event at all and the API reported
	// success. Mirrors internal/ticketing, which propagates the same call.
	if s.workflow != nil {
		if err := s.workflow.workflowRepo.Create(ctx, &models.WorkflowHistory{
			ID:          uuid.New().String(),
			TenantID:    tenantID,
			TicketID:    ticket.ID,
			Action:      "create",
			FromStatus:  "",
			ToStatus:    models.StatusOpen,
			PerformedBy: createdBy,
			CreatedAt:   time.Now().UTC(),
		}); err != nil {
			return nil, err
		}
	}

	// Create SLA record
	if s.sla != nil {
		s.sla.CreateRecordForTicket(ctx, tenantID, ticket.ID, ticket.Priority)
	}

	// Check assignment rules
	if s.ruleRepo != nil {
		rule, _ := s.ruleRepo.FindMatching(ctx, ticket.Type, ticket.Priority)
		if rule != nil {
			s.repo.UpdateAssignee(ctx, ticket.ID, tenantID, rule.Assignee)
			s.repo.UpdateStatus(ctx, ticket.ID, tenantID, models.StatusAssigned)
			ticket.AssignedTo = rule.Assignee
			ticket.Status = models.StatusAssigned
		}
	}

	return ticket, nil
}

func (s *TicketService) GetByID(ctx context.Context, id, tenantID string) (*models.Ticket, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "TicketService.GetByID")
	defer span.End()
	return s.repo.GetByID(ctx, id, tenantID)
}

func (s *TicketService) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.Ticket, int, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "TicketService.List")
	defer span.End()

	if q.Page <= 0 {
		q.Page = 1
	}
	if q.PageSize <= 0 {
		q.PageSize = 20
	}
	return s.repo.List(ctx, tenantID, q)
}

func (s *TicketService) Update(ctx context.Context, ticket *models.Ticket) error {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "TicketService.Update")
	defer span.End()
	return s.repo.Update(ctx, ticket)
}

func (s *TicketService) Delete(ctx context.Context, id, tenantID string) error {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "TicketService.Delete")
	defer span.End()
	return s.repo.Delete(ctx, id, tenantID)
}

func (s *TicketService) Resolve(ctx context.Context, id, tenantID, performedBy string) error {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "TicketService.Resolve")
	defer span.End()

	if s.workflow != nil {
		_, _, err := s.workflow.TransitionStatus(ctx, id, tenantID, models.StatusResolved, performedBy, "")
		return err
	}
	return s.repo.UpdateStatus(ctx, id, tenantID, "resolved")
}

func (s *TicketService) Assign(ctx context.Context, id, tenantID, assignedTo string) error {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "TicketService.Assign")
	defer span.End()

	if err := s.repo.UpdateAssignee(ctx, id, tenantID, assignedTo); err != nil {
		return err
	}

	// Transition to assigned status. Only when it is not already assigned:
	// ValidTransitions has no assigned -> assigned self-loop, so re-assigning a
	// ticket to a different engineer would otherwise fail on validation after the
	// assignee update had already committed. Propagated instead of discarded so a
	// storage failure cannot read as a successful assignment.
	if s.workflow != nil {
		cur, err := s.repo.GetByID(ctx, id, tenantID)
		if err != nil {
			return err
		}
		if cur.Status != models.StatusAssigned {
			if _, _, err := s.workflow.TransitionStatus(ctx, id, tenantID, models.StatusAssigned, "system", "auto-assigned"); err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *TicketService) TransitionStatus(ctx context.Context, ticketID, tenantID, toStatus, performedBy, reason string) (*models.Ticket, *models.WorkflowHistory, error) {
	if s.workflow == nil {
		return nil, nil, fmt.Errorf("workflow service not configured")
	}
	return s.workflow.TransitionStatus(ctx, ticketID, tenantID, toStatus, performedBy, reason)
}

func (s *TicketService) GetWorkflowHistory(ctx context.Context, tenantID, ticketID string) ([]models.WorkflowHistory, error) {
	if s.workflow == nil {
		return nil, nil
	}
	return s.workflow.GetWorkflowHistory(ctx, tenantID, ticketID)
}

func (s *TicketService) AddComment(ctx context.Context, ticketID, tenantID string, req *models.CreateCommentRequest) (*models.TicketComment, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "TicketService.AddComment")
	defer span.End()

	if _, err := s.repo.GetByID(ctx, ticketID, tenantID); err != nil {
		return nil, err
	}

	comment := &models.TicketComment{
		ID:         uuid.New().String(),
		TicketID:   ticketID,
		Author:     req.Author,
		Content:    req.Content,
		IsInternal: req.IsInternal,
	}

	if err := s.comment.Create(ctx, comment); err != nil {
		return nil, err
	}
	return comment, nil
}

func (s *TicketService) ListComments(ctx context.Context, ticketID, tenantID string) ([]models.TicketComment, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "TicketService.ListComments")
	defer span.End()

	if _, err := s.repo.GetByID(ctx, ticketID, tenantID); err != nil {
		return nil, err
	}
	return s.comment.ListByTicket(ctx, ticketID)
}

func (s *TicketService) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// Escalate escalates a ticket's priority
func (s *TicketService) Escalate(ctx context.Context, ticketID, tenantID, escalatedBy, reason string) (*models.Ticket, error) {
	ticket, err := s.repo.GetByID(ctx, ticketID, tenantID)
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

	if err := s.repo.Update(ctx, ticket); err != nil {
		return nil, err
	}

	// Record in workflow. Action is "escalate" and ToStatus is deliberately left
	// at the ticket's current status: escalating raises priority, it does not move
	// the ticket through the state machine. Propagated, as with the create event
	// above, so a lost audit row cannot read as a successful escalation.
	if s.workflow != nil {
		if err := s.workflow.workflowRepo.Create(ctx, &models.WorkflowHistory{
			ID:          uuid.New().String(),
			TenantID:    tenantID,
			TicketID:    ticketID,
			Action:      "escalate",
			FromStatus:  ticket.Status,
			ToStatus:    ticket.Status,
			PerformedBy: escalatedBy,
			Reason:      "escalated: " + reason,
			CreatedAt:   time.Now().UTC(),
		}); err != nil {
			return nil, err
		}
	}

	return ticket, nil
}

// Close closes a ticket
func (s *TicketService) Close(ctx context.Context, ticketID, tenantID, performedBy, reason string) (*models.Ticket, error) {
	if s.workflow != nil {
		ticket, _, err := s.workflow.TransitionStatus(ctx, ticketID, tenantID, models.StatusClosed, performedBy, reason)
		return ticket, err
	}

	if err := s.repo.UpdateStatus(ctx, ticketID, tenantID, "closed"); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, ticketID, tenantID)
}
