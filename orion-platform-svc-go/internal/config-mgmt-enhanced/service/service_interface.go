package service

import (
	"context"
	"orion/platform-svc-go/internal/config-mgmt-enhanced/models"
)

type ServiceInterface interface {
	ApproveChangeRequest(ctx context.Context, tenantID, id string, req *models.ApproveRequest) (*models.ChangeRequest, error)
	ExecuteChangeRequest(ctx context.Context, tenantID, id string) (*models.ChangeRequest, error)
	RollbackChangeRequest(ctx context.Context, tenantID, id string, req *models.RollbackRequest) (*models.ChangeRequest, error)
	GetChangeHistory(ctx context.Context, tenantID, id string) ([]models.ChangeHistoryEntry, error)
	DriftDetect(ctx context.Context, tenantID string, req *models.DriftDetectRequest) (*models.DriftDetectResult, error)
	RemediateDrift(ctx context.Context, tenantID, id string, req *models.RemediateRequest) (*models.DriftReport, error)
	Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.ConfigMgmt, error)
	Get(ctx context.Context, id, tenantID string) (*models.ConfigMgmt, error)
	List(ctx context.Context, tenantID string) ([]models.ConfigMgmt, error)
	Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.ConfigMgmt, error)
	Delete(ctx context.Context, id, tenantID string) (bool, error)
}

var _ ServiceInterface = (*Service)(nil)
