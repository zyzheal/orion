// Package service defines the ServiceInterface for auto-exec.
//
// Generated to enable handler layer mocking in tests.
package service

import (
	"context"

	"orion/platform-svc-go/internal/auto-exec/models"
)

type ServiceInterface interface {
	CreateTask(ctx context.Context, tenantID string, req models.CreateTaskRequest) (*models.ExecutionTask, error)
	GetTask(ctx context.Context, tenantID string, id string) (*models.ExecutionTask, error)
	ListTasks(ctx context.Context, tenantID string, status string, limit, offset int) (*models.TaskListResponse, error)
	DeleteTask(ctx context.Context, tenantID string, id string) error
	ExecuteTask(ctx context.Context, taskID string, req *models.RunTaskRequest) (*models.ExecutionTask, error)
	GetHistory(ctx context.Context, tenantID string, taskID string, limit, offset int) (*models.HistoryListResponse, error)

	RegisterPlugin(ctx context.Context, tenantID string, req models.RegisterPluginRequest) (*models.PluginSPI, error)
	ListPlugins(ctx context.Context, tenantID string, category string, limit, offset int) (*models.PluginListResponse, error)
	GetPlugin(ctx context.Context, name string) (*models.PluginSPI, error)
	UpdatePlugin(ctx context.Context, tenantID string, name string, fields map[string]any) (*models.PluginSPI, error)

	ListEnginePlugins() []models.PluginSPI
}

var _ ServiceInterface = (*Service)(nil)
