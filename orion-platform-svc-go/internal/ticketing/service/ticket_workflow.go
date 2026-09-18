package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
)

func (s *Service) canTransition(from, to string) bool {
	allowed, ok := validTransitions[from]
	if !ok {
		return false
	}
	for _, a := range allowed {
		if a == to {
			return true
		}
	}
	return false
}

func (s *Service) TransitionStatus(ctx context.Context, tenantID, ticketID string, req models.TransitionRequest, userID string) (*models.Ticket, error) {
	t, err := s.repo.GetTicket(ctx, tenantID, ticketID)
	if err != nil {
		return nil, err
	}
	if !s.canTransition(t.Status, req.Status) {
		return nil, fmt.Errorf("invalid transition from %q to %q", t.Status, req.Status)
	}
	// resolved_at and closed_at are stamped in the same statement as the status
	// change, so a caller cannot observe a resolved ticket with no resolution
	// time. The write error used to be dropped here, which answered 200 for a
	// transition that never persisted.
	now := time.Now().UTC()
	fields := map[string]interface{}{"status": req.Status}
	if req.Status == "resolved" {
		fields["resolved_at"] = now
	} else if req.Status == "closed" {
		fields["closed_at"] = now
	}
	if err := s.repo.UpdateTicket(ctx, tenantID, ticketID, fields); err != nil {
		return nil, err
	}
	if err := s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "transition", t.Status, req.Status, userID, req.Comment); err != nil {
		return nil, err
	}
	if req.Status == "resolved" || req.Status == "closed" {
		// The ticket is already resolved in the database by this point, so this
		// is not a rollback but it is not safe to answer success while the SLA
		// row still claims the ticket is open.
		if err := s.repo.UpdateSLATracking(ctx, ticketID, map[string]interface{}{
			"resolved_at": now,
		}); err != nil {
			return nil, err
		}
	}
	return s.repo.GetTicket(ctx, tenantID, ticketID)
}

func (s *Service) AssignTicket(ctx context.Context, tenantID, ticketID string, req models.AssignRequest, userID string) (*models.Ticket, error) {
	t, err := s.repo.GetTicket(ctx, tenantID, ticketID)
	if err != nil {
		return nil, err
	}
	// The assignment row is the audit trail for who owns the ticket, so a
	// failure here means the status update below would leave an owner with no
	// record. It used to be dropped, returning 200 with the assignment missing.
	if err := s.repo.CreateAssignment(ctx, tenantID, ticketID, req.AssigneeID, userID, req.Comment); err != nil {
		return nil, err
	}
	status := t.Status
	if status == "open" {
		status = "assigned"
	}
	if err := s.repo.UpdateTicket(ctx, tenantID, ticketID, map[string]interface{}{
		"status":      status,
		"assignee_id": req.AssigneeID,
	}); err != nil {
		return nil, err
	}
	if err := s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "assign", t.Status, status, userID, req.Comment); err != nil {
		return nil, err
	}
	return s.repo.GetTicket(ctx, tenantID, ticketID)
}

func (s *Service) EscalateTicket(ctx context.Context, tenantID, ticketID string, req models.EscalateRequest, userID string) (*models.Ticket, error) {
	t, err := s.repo.GetTicket(ctx, tenantID, ticketID)
	if err != nil {
		return nil, err
	}
	priority := t.Priority
	priorityOrder := []string{"low", "medium", "high", "critical"}
	idx := -1
	for i, p := range priorityOrder {
		if p == priority {
			idx = i
			break
		}
	}
	if idx >= 0 && idx < len(priorityOrder)-1 {
		priority = priorityOrder[idx+1]
		if err := s.repo.UpdateTicket(ctx, tenantID, ticketID, map[string]interface{}{"priority": priority}); err != nil {
			return nil, err
		}
	}
	// Escalate moves the priority, not the status, so the audit row records the
	// priority pair. The old from_state/to_state pair was ""/"escalated", which
	// is not a member of validTransitions and could never be joined back to a
	// status transition.
	if err := s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "escalate", t.Priority, priority, userID, req.Reason); err != nil {
		return nil, err
	}
	return s.repo.GetTicket(ctx, tenantID, ticketID)
}

func (s *Service) ResolveTicket(ctx context.Context, tenantID, ticketID string, req models.ResolveRequest, userID string) (*models.Ticket, error) {
	if err := s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "resolve", "", "resolved", userID, req.Comment); err != nil {
		return nil, err
	}
	// One timestamp for the ticket and the SLA tracking row, so the two tables
	// cannot disagree about when the ticket was resolved.
	now := time.Now().UTC()
	if err := s.repo.UpdateTicket(ctx, tenantID, ticketID, map[string]interface{}{
		"status":      "resolved",
		"resolved_at": now,
	}); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateSLATracking(ctx, ticketID, map[string]interface{}{
		"resolved_at": now,
	}); err != nil {
		return nil, err
	}
	return s.repo.GetTicket(ctx, tenantID, ticketID)
}

func (s *Service) CloseTicket(ctx context.Context, tenantID, ticketID string, comment, userID string) (*models.Ticket, error) {
	if err := s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "close", "", "closed", userID, comment); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateTicket(ctx, tenantID, ticketID, map[string]interface{}{
		"status":    "closed",
		"closed_at": time.Now().UTC(),
	}); err != nil {
		return nil, err
	}
	return s.repo.GetTicket(ctx, tenantID, ticketID)
}

func (s *Service) GetWorkflowHistory(ctx context.Context, tenantID, ticketID string) ([]models.WorkflowHistoryEntry, error) {
	return s.repo.GetWorkflowHistory(ctx, tenantID, ticketID)
}

// --- Assignment Rules ---

func (s *Service) AddAssignmentRule(ctx context.Context, tenantID string, req models.CreateAssignmentRuleRequest) (*models.AssignmentRule, error) {
	return s.repo.CreateAssignmentRule(ctx, tenantID, req)
}

func (s *Service) GetAssignmentRules(ctx context.Context, tenantID string) ([]models.AssignmentRule, error) {
	return s.repo.ListAssignmentRules(ctx, tenantID)
}

func (s *Service) RemoveAssignmentRule(ctx context.Context, tenantID string, id string) error {
	return s.repo.DeleteAssignmentRule(ctx, tenantID, id)
}

// --- Relations ---

func (s *Service) AddRelation(ctx context.Context, tenantID, ticketID string, req models.CreateRelationRequest) (*models.TicketRelation, error) {
	return s.repo.AddRelation(ctx, tenantID, ticketID, req.RelatedID, req.Type)
}

func (s *Service) GetRelations(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error) {
	return s.repo.GetRelations(ctx, tenantID, ticketID)
}

func (s *Service) FindRelatedTickets(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error) {
	return s.repo.FindRelatedTickets(ctx, tenantID, ticketID)
}

func (s *Service) DetectDuplicates(ctx context.Context, tenantID, ticketID string) ([]models.TicketRelation, error) {
	return s.repo.DetectDuplicates(ctx, tenantID, ticketID)
}

// CorrelateRootCause analyzes a set of tickets for common root causes based on
// matching category + source signature. Mirrors TS TicketWorkflowService correlation.
func (s *Service) CorrelateRootCause(ctx context.Context, tenantID string, ticketIDs []string) (map[string]interface{}, error) {
	if len(ticketIDs) == 0 {
		return map[string]interface{}{"correlated": false, "reason": "no tickets provided"}, nil
	}
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	byID := make(map[string]*models.Ticket)
	for i := range tickets {
		byID[tickets[i].ID] = &tickets[i]
	}
	groups := make(map[string][]string)
	for _, id := range ticketIDs {
		t, ok := byID[id]
		if !ok {
			continue
		}
		groups[t.Category+"|"+t.Source] = append(groups[t.Category+"|"+t.Source], id)
	}
	correlated := len(groups) == 1 && len(groups) > 0
	return map[string]interface{}{
		"ticket_ids": ticketIDs,
		"correlated": correlated,
		"groups":     groups,
	}, nil
}

// --- SLA ---
