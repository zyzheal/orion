package service

import (
	"context"
	"github.com/orion/agent-svc/internal/agent/repository"
)

type TaskService interface {
	CreateTask(ctx context.Context, agentID, taskType, params string) (interface{}, error)
	ListTasks(ctx context.Context, agentID string) (interface{}, error)
	GetTask(ctx context.Context, id string) (interface{}, error)
	ExecuteTask(ctx context.Context, id string) (interface{}, error)
	CancelTask(ctx context.Context, id string) error
}

type taskServiceImpl struct {
	AgentRepo repository.AgentRepository
}

func NewTaskService(repo repository.AgentRepository) TaskService {
	return &taskServiceImpl{AgentRepo: repo}
}

func (s *taskServiceImpl) CreateTask(ctx context.Context, agentID, taskType, params string) (interface{}, error) {
	return nil, nil
}
func (s *taskServiceImpl) ListTasks(ctx context.Context, agentID string) (interface{}, error) { return nil, nil }
func (s *taskServiceImpl) GetTask(ctx context.Context, id string) (interface{}, error) { return nil, nil }
func (s *taskServiceImpl) ExecuteTask(ctx context.Context, id string) (interface{}, error) { return nil, nil }
func (s *taskServiceImpl) CancelTask(ctx context.Context, id string) error { return nil }
