package repository

import (
	"context"
	"orion/platform-svc-go/internal/deployment-trigger/models"
)


// RepositoryInterface defines the data access contract for the deployment-trigger module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req *models.CreateTriggerRequest) (*models.DeploymentTrigger, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.DeploymentTrigger, error)
	List(ctx context.Context, tenantID string) ([]models.DeploymentTrigger, error)
	Update(ctx context.Context, tenantID, id string, req *models.UpdateTriggerRequest) (*models.DeploymentTrigger, error)
	Delete(ctx context.Context, tenantID, id string) error
	CreateExecution(ctx context.Context, ex *models.TriggerExecution) error
	GetExecutions(ctx context.Context, triggerID, tenantID string, limit int) ([]models.TriggerExecution, error)
	GetLatestExecution(ctx context.Context, triggerID, tenantID string) (*models.TriggerExecution, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
