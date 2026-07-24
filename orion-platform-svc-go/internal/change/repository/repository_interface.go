package repository

import (
	"context"
	"orion/platform-svc-go/internal/change/models"
)


// RepositoryInterface defines the data access contract for the change module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateChangeRequest(ctx context.Context, m *models.ChangeRequest) error
	GetChangeRequest(ctx context.Context, tenantID, id string) (*models.ChangeRequest, error)
	ListChangeRequests(ctx context.Context, tenantID string, q models.ChangeRequestListQuery) (*models.ListResult[models.ChangeRequest], error)
	UpdateChangeRequest(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.ChangeRequest, error)
	DeleteChangeRequest(ctx context.Context, tenantID, id string) error
	UpdateStatus(ctx context.Context, tenantID, id, status, reason string) (*models.ChangeRequest, error)
	CreateTimelineEvent(ctx context.Context, event *models.TimelineEvent) error
	ListTimelineEvents(ctx context.Context, tenantID, changeRequestID string, limit, offset int) ([]models.TimelineEvent, error)
	GetStats(ctx context.Context, tenantID string) (*models.ChangeStats, error)
	CreateRFC(ctx context.Context, tenantID string, rfc *models.RFC) error
	GetRFC(ctx context.Context, tenantID, id string) (*models.RFC, error)
	ListRFCs(ctx context.Context, tenantID string, limit, offset int) (*models.ListResult[models.RFC], error)
	UpdateRFC(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.RFC, error)
	CreateCABMeeting(ctx context.Context, tenantID string, meeting *models.CABMeeting) error
	GetCABMeeting(ctx context.Context, tenantID, id string) (*models.CABMeeting, error)
	ListCABMeetings(ctx context.Context, tenantID string, q models.CABMeetingListQuery) (*models.ListResult[models.CABMeeting], error)
	UpdateCABMeeting(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.CABMeeting, error)
	AddCABDecision(ctx context.Context, tenantID, cabID, changeRequestID, decision, notes string) (*models.CABDecision, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
