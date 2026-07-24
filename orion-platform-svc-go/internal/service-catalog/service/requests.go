package service

import (
	"context"

	"orion/platform-svc-go/internal/service-catalog/models"
)

// UpdateRequestStatus validates and persists a status transition.
func (s *Service) UpdateRequestStatus(ctx context.Context, tenantID, id string, req *models.StatusUpdateRequest) (*models.ServiceRequest, error) {
	assignedTo := (*string)(nil)
	if req.AssignedTo != "" {
		assignedTo = &req.AssignedTo
	}
	by := "system"
	result, err := s.repo.UpdateRequestStatus(ctx, tenantID, id, req.Status, req.Comment, assignedTo, by)
	if err != nil {
		return nil, err
	}
	return result, nil
}

// GetRequestTimeline returns timeline entries for a request.
func (s *Service) GetRequestTimeline(ctx context.Context, tenantID, id string) ([]models.TimelineEntry, error) {
	entries, err := s.repo.GetRequestTimeline(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return entries, nil
}

// GetSLABreaches returns requests that have breached their SLA targets.
func (s *Service) GetSLABreaches(ctx context.Context, tenantID string, q *models.SLABreachesQuery) (*models.SLABreachesResponse, error) {
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 20
	}
	breaches, err := s.repo.GetSLABreaches(ctx, tenantID, q.Service, q.From, q.Limit)
	if err != nil {
		return nil, err
	}
	// Filter out zero-overdue entries (should not happen, but safety net)
	var valid []models.SLABreach
	for _, b := range breaches {
		if b.OverdueMs > 0 {
			valid = append(valid, b)
		}
	}
	return &models.SLABreachesResponse{
		Total:    len(valid),
		Breaches: valid,
	}, nil
}
