package repository

import (
	"context"
	"orion/platform-svc-go/internal/deploy-enhanced/models"
)


// RepositoryInterface defines the data access contract for the deploy-enhanced module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateWindow(ctx context.Context, w *models.DeployWindow) error
	GetWindowByID(ctx context.Context, id string, tenantID string) (*models.DeployWindow, error)
	ListWindows(ctx context.Context, tenantID string, environmentID *string, status *string) ([]models.DeployWindow, error)
	UpdateWindow(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.DeployWindow, error)
	DeleteWindow(ctx context.Context, id string, tenantID string) (bool, error)
	CheckWindowActive(ctx context.Context, tenantID string, environmentID string) (bool, error)
	CreateProgressiveDeploy(ctx context.Context, pd *models.ProgressiveDeploy) error
	GetProgressiveDeploy(ctx context.Context, id string, tenantID string) (*models.ProgressiveDeploy, error)
	UpdateProgressiveDeploy(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.ProgressiveDeploy, error)
	CreateEmergencyDeploy(ctx context.Context, ed *models.EmergencyDeploy) error
	GetEmergencyDeploy(ctx context.Context, id string, tenantID string) (*models.EmergencyDeploy, error)
	ListEmergencyDeploys(ctx context.Context, tenantID string, status *string) ([]models.EmergencyDeploy, error)
	UpdateEmergencyDeploy(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.EmergencyDeploy, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
