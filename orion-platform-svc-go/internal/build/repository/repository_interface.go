package repository

import (
	"context"
	"orion/platform-svc-go/internal/build/models"
)


// RepositoryInterface defines the data access contract for the build module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req models.CreateBuildRequest) (*models.Build, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Build, error)
	List(ctx context.Context, tenantID string, opt models.ListBuildsOptions) ([]models.Build, int, error)
	UpdateStatus(ctx context.Context, tenantID, id string, status models.BuildStatus, updates map[string]interface{}) (*models.Build, error)
	StartBuild(ctx context.Context, tenantID, id string) (*models.Build, error)
	CompleteBuild(ctx context.Context, tenantID, id string, status models.BuildStatus, errMsg string) (*models.Build, error)
	GetByPipelineRun(ctx context.Context, tenantID, pipelineRunID string) (*models.Build, error)
	GetBuildStats(ctx context.Context, tenantID string) (*models.BuildStats, error)
	Delete(ctx context.Context, tenantID, id string) (bool, error)
	CreateEnvironment(ctx context.Context, tenantID string, req models.CreateEnvironmentRequest) (*models.BuildEnvironment, error)
	GetEnvironment(ctx context.Context, tenantID, id string) (*models.BuildEnvironment, error)
	ListEnvironments(ctx context.Context, tenantID string) ([]models.BuildEnvironment, error)
	UpdateEnvironment(ctx context.Context, tenantID, id string, req models.UpdateEnvironmentRequest) (*models.BuildEnvironment, error)
	DeleteEnvironment(ctx context.Context, tenantID, id string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
