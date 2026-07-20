package repository

import (
	"context"
	"orion/platform-svc-go/internal/cron/models"
)


// RepositoryInterface defines the data access contract for the cron module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.CronJob) error
	GetByID(ctx context.Context, tenantID, id string) (*models.CronJob, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.CronJob, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdatePartial(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	Delete(ctx context.Context, tenantID, id string) error
	Enable(ctx context.Context, tenantID, id string) error
	Disable(ctx context.Context, tenantID, id string) error
	CreateExecution(ctx context.Context, m *models.CronJobExecution) error
	ListExecutions(ctx context.Context, tenantID, jobID string, limit, offset int) ([]models.CronJobExecution, error)
	GetExecutionByID(ctx context.Context, tenantID, executionID string) (*models.CronJobExecution, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
