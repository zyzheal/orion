package repository

import (
	"context"
	"orion/platform-svc-go/internal/chaos/models"
)


// RepositoryInterface defines the data access contract for the chaos module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.Experiment) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Experiment, error)
	List(ctx context.Context, tenantID string, status string, limit, offset int) ([]models.Experiment, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	Delete(ctx context.Context, tenantID, id string) error
	UpdateStatus(ctx context.Context, tenantID, id, status string) error
	ListRunning(ctx context.Context, tenantID string) ([]models.Experiment, error)
	CreateRun(ctx context.Context, run *models.ExperimentRun) error
	GetRun(ctx context.Context, tenantID, runID string) (*models.ExperimentRun, error)
	UpdateRunStatus(ctx context.Context, tenantID, runID, status string) error
	CreateInjection(ctx context.Context, rec *models.InjectionRecord) error
	UpdateInjectionStatus(ctx context.Context, tenantID, injectionID, status string) error
	GetInjection(ctx context.Context, tenantID, injectionID string) (*models.InjectionRecord, error)
	ListInjectionsByExperiment(ctx context.Context, tenantID, experimentID string) ([]models.InjectionRecord, error)
	CreateRecovery(ctx context.Context, rec *models.RecoveryRecord) error
	UpdateRecoveryStatus(ctx context.Context, tenantID, experimentID, status, message string) error
	ListRecoveriesByExperiment(ctx context.Context, tenantID, experimentID string) ([]models.RecoveryRecord, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
