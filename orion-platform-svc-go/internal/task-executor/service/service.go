package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/task-executor/models"
	"orion/platform-svc-go/internal/task-executor/repository"
	"go.uber.org/zap"
)

type TaskExecutorService struct {
	repo   *repository.Repository
	logger *zap.Logger
}

func NewTaskExecutorService(repo *repository.Repository, logger *zap.Logger) *TaskExecutorService {
	return &TaskExecutorService{
		repo:   repo,
		logger: logger,
	}
}

// CreateTask creates a new task.
func (s *TaskExecutorService) CreateTask(ctx context.Context, tenantID string, req *models.CreateTaskRequest) (*models.Task, error) {
	now := time.Now()
	timeout := req.TimeoutSec
	if timeout <= 0 {
		timeout = 300
	}

	task := &models.Task{
		ID:          fmt.Sprintf("task_%d", time.Now().UnixNano()),
		TenantID:    tenantID,
		Type:        req.Type,
		Name:        req.Name,
		Description: req.Description,
		Input:       req.Input,
		Status:      "pending",
		TimeoutSec:  timeout,
		CreatedAt:   now,
	}

	if err := s.repo.Create(ctx, task); err != nil {
		return nil, err
	}

	s.logger.Info("task created",
		zap.String("taskId", task.ID),
		zap.String("type", req.Type),
	)
	return task, nil
}

// ExecuteTask executes a task.
func (s *TaskExecutorService) ExecuteTask(ctx context.Context, tenantID string, req *models.ExecuteRequest) (*models.Task, error) {
	task, err := s.repo.GetByID(ctx, req.TaskID, tenantID)
	if err != nil {
		return nil, err
	}
	if task.Status != "pending" {
		return nil, fmt.Errorf("task is not pending: %s", task.Status)
	}

	// Mark the task as running and persist the transition before executing.
	task.Status = "running"
	if err := s.repo.UpdateStatus(ctx, task.ID, tenantID, "running"); err != nil {
		return nil, fmt.Errorf("mark task running: %w", err)
	}

	now := time.Now()

	// Use a result channel to avoid concurrent access to task in the goroutine.
	type execResult struct {
		output map[string]interface{}
		err    error
	}
	done := make(chan execResult, 1)
	go func() {
		result, execErr := s.execute(ctx, task.Type, task.Input)
		done <- execResult{output: result, err: execErr}
	}()

	select {
	case res := <-done:
		if res.err != nil {
			task.Status = "failed"
			task.Output = map[string]interface{}{"error": res.err.Error()}
		} else {
			task.Status = "completed"
			task.Output = res.output
		}
	case <-time.After(time.Duration(task.TimeoutSec) * time.Second):
		task.Status = "failed"
		task.Output = map[string]interface{}{"error": "timeout exceeded"}
		s.logger.Warn("task timed out",
			zap.String("taskId", task.ID),
			zap.Int("timeoutSec", task.TimeoutSec),
		)
	case <-ctx.Done():
		task.Status = "cancelled"
		s.logger.Info("task cancelled",
			zap.String("taskId", task.ID),
		)
	}

	task.CompletedAt = &now
	if err := s.repo.Update(ctx, task); err != nil {
		s.logger.Error("failed to persist task state", zap.Error(err))
	}

	s.logger.Info("task completed",
		zap.String("taskId", task.ID),
		zap.String("status", task.Status),
	)
	return task, nil
}

// execute runs the task's logic, honoring context cancellation.
func (s *TaskExecutorService) execute(ctx context.Context, taskType string, input map[string]interface{}) (map[string]interface{}, error) {
	s.logger.Debug("executing task",
		zap.String("type", taskType),
	)

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	switch taskType {
	case "http_request":
		return map[string]interface{}{"status": 200, "data": "response"}, nil
	case "data_processing":
		return map[string]interface{}{"processed": true, "records": 100}, nil
	case "analysis":
		return map[string]interface{}{"result": "analysis completed"}, nil
	case "custom":
		return map[string]interface{}{"executed": true}, nil
	default:
		return nil, fmt.Errorf("unknown task type: %s", taskType)
	}
}

// GetTask returns a task by ID.
func (s *TaskExecutorService) GetTask(ctx context.Context, tenantID, id string) (*models.Task, error) {
	return s.repo.GetByID(ctx, id, tenantID)
}

// QueryTasks returns paginated tasks.
func (s *TaskExecutorService) QueryTasks(ctx context.Context, tenantID string, status string, limit, offset int) (models.TaskResponse, error) {
	tasks, total, err := s.repo.GetAll(ctx, tenantID, status, limit, offset)
	if err != nil {
		return models.TaskResponse{}, err
	}
	return models.TaskResponse{Data: tasks, Total: total}, nil
}

// CancelTask cancels a pending or running task.
func (s *TaskExecutorService) CancelTask(ctx context.Context, tenantID, id string) (*models.Task, error) {
	task, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	if task.Status != "pending" && task.Status != "running" {
		return nil, fmt.Errorf("task cannot be cancelled: %s", task.Status)
	}

	task.Status = "cancelled"
	now := time.Now()
	task.CompletedAt = &now

	if err := s.repo.Update(ctx, task); err != nil {
		return nil, err
	}

	s.logger.Info("task cancelled",
		zap.String("taskId", id),
	)
	return task, nil
}