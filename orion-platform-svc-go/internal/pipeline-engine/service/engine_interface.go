package service

import (
	"context"

	"orion/platform-svc-go/internal/pipeline-engine/models"
)

type EngineInterface interface {
	Execute(ctx context.Context, tenantID string, req models.TriggerRequest) (*models.PipelineRun, error)
	CancelRun(ctx context.Context, tenantID, runID, triggerBy string) (*models.PipelineRun, error)
	GetRun(ctx context.Context, tenantID, runID string) (*models.PipelineRun, error)
	ListRuns(ctx context.Context, tenantID, pipelineID string, q models.ListRunsQuery) (*models.RunListResponse, error)
	GetStages(ctx context.Context, tenantID, runID string) ([]models.Stage, error)
	GetTasks(ctx context.Context, tenantID, stageID string) ([]models.Task, error)
}

var _ EngineInterface = (*PipelineEngine)(nil)
