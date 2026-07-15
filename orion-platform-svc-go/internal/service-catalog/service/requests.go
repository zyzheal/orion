package service

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/service-catalog/models"
)

// validStatusTransitions defines allowed status transitions for service requests.
var validStatusTransitions = map[string][]string{
	"pending":     {"approved", "rejected", "cancelled"},
	"approved":    {"in_progress", "cancelled"},
	"in_progress": {"fulfilled", "cancelled"},
	"fulfilled":   {},
	"rejected":    {},
	"cancelled":   {},
}

// updateRequestStatusLocked performs the status transition without reading the
// current row (stub — real implementation validates the transition).
func (s *Service) UpdateRequestStatus(ctx context.Context, tenantID, id string, req *models.StatusUpdateRequest) (*models.ServiceRequest, error) {
	now := time.Now().UTC()
	nowUnix := now.UnixMilli()

	result := &models.ServiceRequest{
		ID:         id,
		TenantID:   tenantID,
		Status:     req.Status,
		AssignedTo: req.AssignedTo,
		UpdatedAt:  nowUnix,
	}

	// TODO: read current request row and validate the transition against
	// validStatusTransitions, persist the new status, and append a timeline
	// entry. Stubbed here until the request/timeline repositories exist.
	_ = ctx

	return result, nil
}

// GetRequestTimeline returns all timeline entries for a given request.
func (s *Service) GetRequestTimeline(ctx context.Context, tenantID, id string) ([]models.TimelineEntry, error) {
	// TODO: verify request exists and belongs to tenant, then query the
	// timeline table for entries of this request.
	_ = ctx
	_ = tenantID
	_ = id
	return nil, errors.New("not yet implemented")
}

// GetSLABreaches returns requests that have breached their SLA targets.
func (s *Service) GetSLABreaches(ctx context.Context, tenantID string, q *models.SLABreachesQuery) (*models.SLABreachesResponse, error) {
	// TODO: query requests whose actual resolution time exceeds their SLA
	// target. Optional filters: q.Service, q.From (window start), q.Limit.
	// For each breached request compute overdueMs = actualMs - slaTargetMs.
	_ = ctx
	_ = tenantID
	_ = q
	return nil, errors.New("not yet implemented")
}
