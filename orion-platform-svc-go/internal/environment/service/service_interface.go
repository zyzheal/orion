package service

import (
	"context"
	"orion/platform-svc-go/internal/environment/models"
)

type ServiceInterface interface {
	Create(ctx context.Context, tenantID, createdBy string, req *models.CreateEnvironmentRequest) (*models.Environment, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Environment, error)
	List(ctx context.Context, tenantID, projectID string) ([]models.Environment, error)
	Update(ctx context.Context, tenantID, id, updatedBy string, req *models.UpdateEnvironmentRequest) (*models.Environment, error)
	UpdateStatus(ctx context.Context, tenantID, id, status string) (*models.Environment, error)
	Lock(ctx context.Context, tenantID, id string) (*models.Environment, error)
	Unlock(ctx context.Context, tenantID, id string) (*models.Environment, error)
	GetLockStatus(ctx context.Context, tenantID, id string) (bool, error)
	CheckDeploymentAllowed(ctx context.Context, tenantID, id string) (bool, error)
	Delete(ctx context.Context, tenantID, id string) error
}

var _ ServiceInterface = (*Service)(nil)

