// Package service provides the business logic layer for auto-exec.
//
// ARCHITECTURE (Clean Architecture):
//   Handler → Service → Engine + Repository
//
// Previously the handler directly called Engine and Repository,
// violating the Clean Architecture layered dependency rule.
// This service layer now owns all business logic coordination.
package service

import (
	"context"

	"orion/platform-svc-go/internal/auto-exec/engine"
	"orion/platform-svc-go/internal/auto-exec/models"
	"orion/platform-svc-go/internal/auto-exec/plugins"
	"orion/platform-svc-go/internal/auto-exec/repository"
)

// Service coordinates the Engine and Repository for task management.
type Service struct {
	eng  *engine.AutoExecEngine
	repo *repository.Repository
}

func NewService(eng *engine.AutoExecEngine, repo *repository.Repository) *Service {
	return &Service{eng: eng, repo: repo}
}

// ---- Tasks ----

func (s *Service) CreateTask(ctx context.Context, tenantID string, req models.CreateTaskRequest) (*models.ExecutionTask, error) {
	return s.eng.CreateTask(ctx, tenantID, req.Name, req.Plugin, req.PluginParams)
}

func (s *Service) GetTask(ctx context.Context, tenantID string, id string) (*models.ExecutionTask, error) {
	return s.repo.GetTask(ctx, tenantID, id)
}

func (s *Service) ListTasks(ctx context.Context, tenantID string, status string, limit, offset int) (*models.TaskListResponse, error) {
	return s.repo.ListTasks(ctx, tenantID, status, limit, offset)
}

func (s *Service) DeleteTask(ctx context.Context, tenantID string, id string) error {
	return s.repo.DeleteTask(ctx, tenantID, id)
}

func (s *Service) ExecuteTask(ctx context.Context, taskID string, req *models.RunTaskRequest) (*models.ExecutionTask, error) {
	// Validate request params if provided; engine.ExecuteTask only uses taskID
	_ = req // req reserved for future validation; currently engine.ExecuteTask ignores body
	return s.eng.ExecuteTask(ctx, taskID)
}

func (s *Service) GetHistory(ctx context.Context, tenantID string, taskID string, limit, offset int) (*models.HistoryListResponse, error) {
	// Verify task belongs to tenant first
	_, err := s.repo.GetTask(ctx, tenantID, taskID)
	if err != nil {
		return nil, err
	}
	return s.repo.ListHistory(ctx, taskID, limit, offset)
}

// ---- Plugins ----

func (s *Service) RegisterPlugin(ctx context.Context, tenantID string, req models.RegisterPluginRequest) (*models.PluginSPI, error) {
	return s.repo.CreatePlugin(ctx, tenantID, &req)
}

func (s *Service) ListPlugins(ctx context.Context, tenantID string, category string, limit, offset int) (*models.PluginListResponse, error) {
	resp, err := s.repo.ListPlugins(ctx, tenantID, category, limit, offset)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

func (s *Service) GetPlugin(ctx context.Context, name string) (*models.PluginSPI, error) {
	return s.repo.GetPlugin(ctx, name)
}

func (s *Service) UpdatePlugin(ctx context.Context, tenantID string, name string, fields map[string]any) (*models.PluginSPI, error) {
	return s.repo.UpdatePlugin(ctx, tenantID, name, fields)
}

// ---- Engine info ----

func (s *Service) ListEnginePlugins() []models.PluginSPI {
	return s.eng.ListPlugins()
}

// ---- Pipeline integration ----

// TriggerPipeline triggers a pipeline execution via the configured pipeline runner.
// It delegates to plugins.TriggerPipeline which uses the package-level runner
// injected via plugins.SetTriggerPipelineRunner at startup.
func (s *Service) TriggerPipeline(ctx context.Context, pipelineID string, params map[string]any) (*plugins.PipelineRunResult, error) {
	return plugins.TriggerPipeline(ctx, pipelineID, params)
}
