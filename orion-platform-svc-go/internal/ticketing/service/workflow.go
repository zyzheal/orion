package service

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/go-common/pkg/otel"
	"orion/platform-svc-go/internal/ticketing/repository"
)

// wfValidTransitions defines allowed status transitions (from -> [to, ...])
var wfValidTransitions = map[string][]string{
	"open":       {"in_progress", "closed", "cancelled"},
	"in_progress": {"open", "closed", "cancelled"},
	"closed":     {"reopened"},
	"reopened":   {"in_progress", "closed", "cancelled"},
	"cancelled":  {"open"},
}

type WorkflowService struct {
	workflowRepo repository.WorkflowRepositoryInterface
	ticketRepo   repository.TicketRepositoryInterface
}

func NewWorkflowService(workflowRepo repository.WorkflowRepositoryInterface, ticketRepo repository.TicketRepositoryInterface) *WorkflowService {
	return &WorkflowService{workflowRepo: workflowRepo, ticketRepo: ticketRepo}
}

// TransitionStatus performs a validated status transition
func (s *WorkflowService) TransitionStatus(ctx context.Context, ticketID, tenantID, toStatus, performedBy, reason string) (*models.Ticket, *models.WorkflowHistory, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "WorkflowService.TransitionStatus")
	defer span.End()

	ticket, err := s.ticketRepo.GetByID(ctx, ticketID, tenantID)
	if err != nil {
		return nil, nil, fmt.Errorf("ticket not found: %w", err)
	}

	// Validate transition using hardcoded map
	allowed, ok := wfValidTransitions[ticket.Status]
	if !ok {
		return nil, nil, fmt.Errorf("no transitions from status: %s", ticket.Status)
	}

	valid := false
	for _, v := range allowed {
		if v == toStatus {
			valid = true
			break
		}
	}
	if !valid {
		return nil, nil, fmt.Errorf("invalid transition from %s to %s", ticket.Status, toStatus)
	}

	// Record workflow history
	history := &models.WorkflowHistory{
		ID:          0,
		TicketID:    ticketID,
		FromState:   ticket.Status,
		ToState:     toStatus,
		FromStatus:  ticket.Status,
		ToStatus:    toStatus,
		UserID:      performedBy,
		Comment:     reason,
		PerformedBy: performedBy,
		Reason:      reason,
	}

	if err := s.workflowRepo.Create(ctx, history); err != nil {
		return nil, nil, fmt.Errorf("failed to record workflow: %w", err)
	}

	// Update ticket status
	if err := s.ticketRepo.UpdateStatus(ctx, ticketID, tenantID, toStatus); err != nil {
		return nil, nil, fmt.Errorf("failed to update status: %w", err)
	}

	ticket.Status = toStatus
	return ticket, history, nil
}

// GetWorkflowHistory returns the full workflow history for a ticket
func (s *WorkflowService) GetWorkflowHistory(ctx context.Context, ticketID string) ([]models.WorkflowHistory, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "WorkflowService.GetWorkflowHistory")
	defer span.End()

	entries, err := s.workflowRepo.GetWorkflowHistory(ctx, "", ticketID)
	if err != nil {
		return nil, fmt.Errorf("failed to get workflow history: %w", err)
	}
	// Convert WorkflowHistoryEntry to WorkflowHistory
	out := make([]models.WorkflowHistory, 0, len(entries))
	for _, e := range entries {
		out = append(out, models.WorkflowHistory{
			ID:          e.ID,
			TicketID:    e.TicketID,
			FromStatus:  e.FromState,
			ToStatus:    e.ToState,
			PerformedBy: e.UserID,
			Reason:      e.Comment,
			CreatedAt:   e.CreatedAt,
		})
	}
	return out, nil
}
