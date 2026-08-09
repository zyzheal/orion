package service

import (
	"context"
	"orion/platform-svc-go/internal/pipeline-trend/models"
)

// ServiceInterface defines the interface for the pipeline-trend service.
type ServiceInterface interface {
	// CRUD
	Create(ctx context.Context, tenantID string, trend *models.PipelineTrend) error
	GetByID(ctx context.Context, tenantID, id string) (*models.PipelineTrend, error)
	GetAll(ctx context.Context, tenantID string) ([]models.PipelineTrend, error)
	Update(ctx context.Context, tenantID string, trend *models.PipelineTrend) error
	Delete(ctx context.Context, tenantID, id string) error

	// Trend aggregation
	GetTrendByPipeline(ctx context.Context, tenantID, pipelineID string) ([]models.PipelineTrend, error)
	GetRunHistoryCompare(ctx context.Context, tenantID string, pipelineIDs []string, period, granularity string) (*models.CompareResponse, error)
	GetRunHistoryTrend(ctx context.Context, tenantID, pipelineID, period, granularity string) (*models.TrendResponse, error)
}

// Ensure compile-time safety: *Service implements ServiceInterface.
var _ ServiceInterface = (*Service)(nil)
