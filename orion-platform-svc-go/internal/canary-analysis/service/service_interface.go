package service

import (
	"context"
	"orion/platform-svc-go/internal/canary-analysis/models"
)

type ServiceInterface interface {
	ForcePromote(ctx context.Context, tenantID string, req *models.ForcePromoteRequest) (*models.Analysis, error)
	ForceRollback(ctx context.Context, tenantID string, req *models.ForceRollbackRequest) (*models.Analysis, error)
	RetrainModel(ctx context.Context, tenantID string, req *models.RetrainRequest) (*models.RetrainResult, error)
	DiscoverMetrics(ctx context.Context, tenantID string, query string) ([]string, error)
	GetRunMetrics(ctx context.Context, tenantID, runID string) (*models.RunMetrics, error)
	GetMLResults(ctx context.Context, tenantID, runID string) (*models.MLResults, error)
	Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.Analysis, error)
	Get(ctx context.Context, id, tenantID string) (*models.Analysis, error)
	List(ctx context.Context, tenantID string) ([]models.Analysis, error)
	Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.Analysis, error)
	Delete(ctx context.Context, id, tenantID string) (bool, error)
}

var _ ServiceInterface = (*Service)(nil)

