package repository

import (
	"context"
	"orion/platform-svc-go/internal/data-pipeline/models"
)

// RepositoryInterface defines the data access contract for the data-pipeline module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	List(ctx context.Context, tenantID string) ([]models.Pipeline, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Pipeline, error)
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Pipeline, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Pipeline, error)
	Delete(ctx context.Context, tenantID, id string) error
	UpdateStatus(ctx context.Context, tenantID, id, status string) (*models.Pipeline, error)

	// PipelineRun operations
	CreateRun(ctx context.Context, tenantID, pipelineID string) (*models.PipelineRun, error)
	GetRunByID(ctx context.Context, tenantID, id string) (*models.PipelineRun, error)
	ListRuns(ctx context.Context, tenantID, pipelineID string) ([]models.PipelineRun, error)
	UpdateRunStatus(ctx context.Context, tenantID, id, status string, errMsg string, metrics string) (*models.PipelineRun, error)
	CancelRun(ctx context.Context, tenantID, id string) (*models.PipelineRun, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
