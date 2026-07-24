package service

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"time"

	"orion/ai-svc-go/internal/task-executor/models"
	"go.uber.org/zap"
)

type TaskExecutorService struct {
	tasks  map[string]*models.Task
	mu     sync.RWMutex
	logger *zap.Logger
}

func NewTaskExecutorService(logger *zap.Logger) *TaskExecutorService {
	return &TaskExecutorService{
		tasks:  make(map[string]*models.Task),
		logger: logger,
	}
}

// CreateTask creates a new task.
func (s *TaskExecutorService) CreateTask(ctx context.Context, tenantID string, req *models.CreateTaskRequest) (*models.Task, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	id := fmt.Sprintf("task_%d", time.Now().UnixNano())
	timeout := req.TimeoutSec
	if timeout <= 0 {
		timeout = 300
	}

	task := &models.Task{
		ID:          id,
		TenantID:    tenantID,
		Type:        req.Type,
		Name:        req.Name,
		Description: req.Description,
		Input:       req.Input,
		Status:      "pending",
		TimeoutSec:  timeout,
		CreatedAt:   now,
	}

	s.tasks[id] = task

	s.logger.Info("task created",
		zap.String("taskId", id),
		zap.String("type", req.Type),
	)
	return task, nil
}

// ExecuteTask executes a task.
func (s *TaskExecutorService) ExecuteTask(ctx context.Context, tenantID string, req *models.ExecuteRequest) (*models.Task, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	task, ok := s.tasks[req.TaskID]
	if !ok {
		return nil, fmt.Errorf("task not found: %s", req.TaskID)
	}
	if task.TenantID != tenantID {
		return nil, fmt.Errorf("task not accessible: %s", req.TaskID)
	}
	if task.Status != "pending" {
		return nil, fmt.Errorf("task is not pending: %s", task.Status)
	}

	// Update status to running
	task.Status = "running"
	now := time.Now()

	// Execute task with timeout
	done := make(chan error, 1)
	go func() {
		result, err := s.execute(task.Type, task.Input)
		if err != nil {
			done <- err
			return
		}
		task.Output = result
		done <- nil
	}()

	// Wait for completion or timeout
	select {
	case err := <-done:
		if err != nil {
			task.Status = "failed"
			task.Output = map[string]interface{}{"error": err.Error()}
		} else {
			task.Status = "completed"
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

	s.logger.Info("task completed",
		zap.String("taskId", task.ID),
		zap.String("status", task.Status),
	)
	return task, nil
}

func (s *TaskExecutorService) execute(taskType string, input map[string]interface{}) (map[string]interface{}, error) {
	s.logger.Debug("executing task",
		zap.String("type", taskType),
	)

	switch taskType {
	case "http_request":
		// Simulate HTTP request
		return map[string]interface{}{"status": 200, "data": "response"}, nil
	case "data_processing":
		// Simulate data processing
		return map[string]interface{}{"processed": true, "records": 100}, nil
	case "analysis":
		// Simulate analysis
		return map[string]interface{}{"result": "analysis completed"}, nil
	case "custom":
		// Custom task execution
		return map[string]interface{}{"executed": true}, nil
	default:
		return nil, fmt.Errorf("unknown task type: %s", taskType)
	}
}

// GetTask returns a task by ID.
func (s *TaskExecutorService) GetTask(ctx context.Context, tenantID, id string) (*models.Task, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	task, ok := s.tasks[id]
	if !ok {
		return nil, fmt.Errorf("task not found: %s", id)
	}
	if task.TenantID != tenantID {
		return nil, fmt.Errorf("task not accessible: %s", id)
	}
	return task, nil
}

// QueryTasks returns paginated tasks.
func (s *TaskExecutorService) QueryTasks(ctx context.Context, tenantID string, status string, limit, offset int) (models.TaskResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var resp models.TaskResponse
	for _, task := range s.tasks {
		if task.TenantID != tenantID {
			continue
	}
		if status != "" && task.Status != status {
			continue
	}
		resp.Data = append(resp.Data, *task)
	}
	resp.Total = int64(len(resp.Data))
	return resp, nil
}

// CancelTask cancels a pending or running task.
func (s *TaskExecutorService) CancelTask(ctx context.Context, tenantID, id string) (*models.Task, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	task, ok := s.tasks[id]
	if !ok {
		return nil, fmt.Errorf("task not found: %s", id)
	}
	if task.TenantID != tenantID {
		return nil, fmt.Errorf("task not accessible: %s", id)
	}
	if task.Status != "pending" && task.Status != "running" {
		return nil, fmt.Errorf("task cannot be cancelled: %s", task.Status)
	}

	task.Status = "cancelled"
	now := time.Now()
	task.CompletedAt = &now

	s.logger.Info("task cancelled",
		zap.String("taskId", id),
	)
	return task, nil
}
