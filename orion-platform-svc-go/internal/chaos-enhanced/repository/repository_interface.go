package repository

import (
	"context"
	"orion/platform-svc-go/internal/chaos-enhanced/models"
)


// RepositoryInterface defines the data access contract for the chaos-enhanced module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateExperiment(ctx context.Context, e *models.Experiment) error
	GetExperiment(ctx context.Context, id string, tenantID string) (*models.Experiment, error)
	ListExperiments(ctx context.Context, tenantID string, status *string, environmentID *string) ([]models.Experiment, error)
	UpdateExperiment(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Experiment, error)
	CreateFaultInjection(ctx context.Context, fi *models.FaultInjection) error
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
