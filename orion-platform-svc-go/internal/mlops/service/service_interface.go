package service

import (
	"context"
	"orion/platform-svc-go/internal/mlops/models"
)

type ServiceInterface interface {
	ListModels(ctx context.Context, tenantID string) ([]models.Model, error)
	GetModel(ctx context.Context, tenantID, id string) (*models.Model, error)
	RegisterModel(ctx context.Context, tenantID string, req models.CreateModelRequest) (*models.Model, error)
	UpdateModel(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Model, error)
	DeleteModel(ctx context.Context, tenantID, id string) error
	DeregisterModel(ctx context.Context, tenantID, id string) error

	Train(ctx context.Context, tenantID, modelID string, req models.TrainingJobRequest) (map[string]interface{}, error)
	Evaluate(ctx context.Context, tenantID, modelID string, req models.CreateExperimentRequest) (map[string]interface{}, error)
	Deploy(ctx context.Context, tenantID, modelID string, req models.CreateDeploymentRequest) (map[string]interface{}, error)
	Rollback(ctx context.Context, tenantID, modelID string, req models.RollbackRequest) (map[string]interface{}, error)
	GetMetrics(ctx context.Context, tenantID, modelID string) (map[string]interface{}, error)

	ListExperiments(ctx context.Context, tenantID, modelID string) ([]models.Experiment, error)
	ListArtifacts(ctx context.Context, tenantID, modelID string) ([]models.Artifact, error)
	ListPipelines(ctx context.Context, tenantID string) ([]models.Pipeline, error)

	RecordMetric(ctx context.Context, tenantID, modelID string, req models.RecordMetricRequest) error
}

var _ ServiceInterface = (*Service)(nil)