package service

import (
	"context"






	"orion/platform-svc-go/internal/ticketing/models"


)

func (s *Service) TransferTicket(ctx context.Context, tenantID, ticketID string, req models.TransferRequest, fromUserID string) error {
	_ = s.repo.AddWorkflowHistory(ctx, tenantID, ticketID, "transfer", "", "assigned", fromUserID, req.Reason)
	return s.repo.TransferTicket(ctx, tenantID, ticketID, fromUserID, req.ToUserID, req.Reason)
}

func (s *Service) GetTransferHistory(ctx context.Context, tenantID, ticketID string) ([]models.TransferHistoryEntry, error) {
	return s.repo.GetTransferHistory(ctx, tenantID, ticketID)
}

func (s *Service) GetTransferStats(ctx context.Context, tenantID string) (*models.TransferStats, error) {
	stats, err := s.repo.GetTransferStats(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	count, _ := s.repo.CountTickets(ctx, tenantID)
	if count > 0 {
		stats.AvgTransfers = float64(stats.TotalTransfers) / float64(count)
	}
	return stats, nil
}

// --- Suspend ---

func (s *Service) CreateSuspend(ctx context.Context, tenantID string, req models.CreateSuspendRequest) (*models.Suspend, error) {
	if req.Type == "" {
		req.Type = "adhoc"
	}
	return s.repo.CreateSuspend(ctx, tenantID, req)
}

func (s *Service) ActivateSuspend(ctx context.Context, tenantID, id string) (*models.Suspend, error) {
	if err := s.repo.UpdateSuspendStatus(ctx, tenantID, id, "active"); err != nil {
		return nil, err
	}
	return s.repo.GetSuspend(ctx, tenantID, id)
}

func (s *Service) EndSuspend(ctx context.Context, tenantID, id string) (*models.Suspend, error) {
	if err := s.repo.UpdateSuspendStatus(ctx, tenantID, id, "completed"); err != nil {
		return nil, err
	}
	return s.repo.GetSuspend(ctx, tenantID, id)
}

func (s *Service) CancelSuspend(ctx context.Context, tenantID, id string) (*models.Suspend, error) {
	if err := s.repo.UpdateSuspendStatus(ctx, tenantID, id, "cancelled"); err != nil {
		return nil, err
	}
	return s.repo.GetSuspend(ctx, tenantID, id)
}

func (s *Service) ListSuspensions(ctx context.Context, tenantID string) ([]models.Suspend, error) {
	return s.repo.ListSuspensions(ctx, tenantID)
}

func (s *Service) GetSuspend(ctx context.Context, tenantID, id string) (*models.Suspend, error) {
	return s.repo.GetSuspend(ctx, tenantID, id)
}

func (s *Service) GetEngineerSuspensions(ctx context.Context, tenantID, engineerID string) ([]models.Suspend, error) {
	return s.repo.GetEngineerSuspensions(ctx, tenantID, engineerID)
}

// GetEngineerSuspendImpact estimates how many active tickets would be affected
// if a given engineer were suspended. Mirrors TS EngineerSuspendService.
func (s *Service) GetEngineerSuspendImpact(ctx context.Context, tenantID, engineerID string) (*models.EngineerSuspendImpact, error) {
	tickets, err := s.repo.ListTickets(ctx, tenantID, models.TicketListQuery{})
	if err != nil {
		return nil, err
	}
	affected := 0
	for _, t := range tickets {
		if t.AssigneeID != nil && *t.AssigneeID == engineerID && t.Status != "resolved" && t.Status != "closed" {
			affected++
		}
	}
	return &models.EngineerSuspendImpact{
		EngineerID:  engineerID,
		AffectedTix: affected,
	}, nil
}

