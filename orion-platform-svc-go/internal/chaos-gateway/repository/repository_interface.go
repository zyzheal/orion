package repository

import (
	"context"
	"orion/platform-svc-go/internal/chaos-gateway/models"
)


// RepositoryInterface defines the data access contract for the chaos-gateway module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateExperiment(ctx context.Context, exp *models.ChaosExperiment) error
	GetExperiment(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error)
	UpdateExperiment(ctx context.Context, tenantID, id string, patch func(*models.ChaosExperiment)) error
	UpdateStatus(ctx context.Context, tenantID, id string, status models.ExperimentStatus, completedAt *int64) error
	DeleteExperiment(ctx context.Context, tenantID, id string) error
	ListExperiments(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ChaosExperiment, int, error)
	CreateResult(ctx context.Context, res *models.ExperimentResult) error
	ListResults(ctx context.Context, tenantID, experimentID string, limit, offset int) ([]models.ExperimentResult, int, error)
	CreateLog(ctx context.Context, log *models.ExperimentLog) error
	ListLogs(ctx context.Context, tenantID, experimentID string, limit, offset int) ([]models.ExperimentLog, int, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
