package service

import (
	"context"
	"fmt"

	"orion-ticket-svc-go/internal/models"
	"orion-ticket-svc-go/internal/otel"
	"orion-ticket-svc-go/internal/repository"

	"github.com/google/uuid"
)

type WorkflowService struct {
	workflowRepo repository.WorkflowRepositoryInterface
	ticketRepo   repository.TicketRepositoryInterface
}

func NewWorkflowService(workflowRepo repository.WorkflowRepositoryInterface, ticketRepo repository.TicketRepositoryInterface) *WorkflowService {
	return &WorkflowService{workflowRepo: workflowRepo, ticketRepo: ticketRepo}
}

// TransitionStatus performs a validated status transition
func (s *WorkflowService) TransitionStatus(ctx context.Context, ticketID, tenantID, toStatus, performedBy, reason string) (*models.Ticket, *models.WorkflowHistory, error) {
	_, span := otel.Tracer().Start(ctx, "WorkflowService.TransitionStatus")
	defer span.End()

	ticket, err := s.ticketRepo.GetByID(ticketID, tenantID)
	if err != nil {
		return nil, nil, fmt.Errorf("ticket not found: %w", err)
	}

	// Validate transition
	allowed, ok := models.ValidTransitions[ticket.Status]
	if !ok {
		return nil, nil, fmt.Errorf("no transitions from status: %s", ticket.Status)
	}

	valid := false
	for _, s := range allowed {
		if s == toStatus {
			valid = true
			break
		}
	}
	if !valid {
		return nil, nil, fmt.Errorf("invalid transition from %s to %s", ticket.Status, toStatus)
	}

	// Record workflow history
	history := &models.WorkflowHistory{
		ID:          uuid.New().String(),
		TicketID:    ticketID,
		FromStatus:  ticket.Status,
		ToStatus:    toStatus,
		PerformedBy: performedBy,
		Reason:      reason,
	}

	if err := s.workflowRepo.Create(history); err != nil {
		return nil, nil, fmt.Errorf("failed to record workflow: %w", err)
	}

	// Update ticket status
	if err := s.ticketRepo.UpdateStatus(ticketID, tenantID, toStatus); err != nil {
		return nil, nil, fmt.Errorf("failed to update status: %w", err)
	}

	ticket.Status = toStatus
	return ticket, history, nil
}

// GetWorkflowHistory returns the full workflow history for a ticket
func (s *WorkflowService) GetWorkflowHistory(ctx context.Context, ticketID string) ([]models.WorkflowHistory, error) {
	_, span := otel.Tracer().Start(ctx, "WorkflowService.GetWorkflowHistory")
	defer span.End()

	return s.workflowRepo.ListByTicket(ticketID)
}
