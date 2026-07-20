package repository

import (
	"context"
	"orion/platform-svc-go/internal/config-mgmt-enhanced/models"
)


// RepositoryInterface defines the data access contract for the config-mgmt-enhanced module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, entity *models.ConfigMgmt) error
	GetByID(ctx context.Context, id, tenantID string) (*models.ConfigMgmt, error)
	List(ctx context.Context, tenantID string) ([]models.ConfigMgmt, error)
	Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigMgmt, error)
	Delete(ctx context.Context, id, tenantID string) (bool, error)
	CreateChangeRequest(ctx context.Context, cr *models.ChangeRequest) error
	GetChangeRequest(ctx context.Context, id, tenantID string) (*models.ChangeRequest, error)
	ListChangeRequests(ctx context.Context, tenantID string, filter *models.ChangeHistoryFilter) ([]models.ChangeRequest, error)
	UpdateChangeRequest(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ChangeRequest, error)
	DeleteChangeRequest(ctx context.Context, id, tenantID string) (bool, error)
	GetChangeHistory(ctx context.Context, changeRequestID, tenantID string) ([]models.ChangeHistory, error)
	AddChangeHistory(ctx context.Context, h *models.ChangeHistory) error
	CreateDriftReport(ctx context.Context, dr *models.DriftReport) error
	GetDriftReport(ctx context.Context, id, tenantID string) (*models.DriftReport, error)
	UpdateDriftReport(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.DriftReport, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
