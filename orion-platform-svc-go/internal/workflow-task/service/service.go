package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"errors"

	"orion/platform-svc-go/internal/workflow-task/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Claim(ctx context.Context, id string, tenantID string, assigneeID string, comment *string) error
	Complete(ctx context.Context, id string, tenantID string, comment *string, formData *string) error
	Count(ctx context.Context, tenantID string, filter *models.ListFilter) (int, error)
	GetByID(ctx context.Context, id string, tenantID string) (*models.WorkflowTask, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter) ([]models.WorkflowTask, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// ListTasks returns a paginated list of workflow tasks.
func (s *Service) ListTasks(ctx context.Context, tenantID string, filter *models.ListFilter) ([]models.WorkflowTask, int, error) {
	tasks, err := s.repo.List(ctx, tenantID, filter)
	if err != nil {
		return nil, 0, err
	}
	total, err := s.repo.Count(ctx, tenantID, filter)
	if err != nil {
		return nil, 0, err
	}
	if tasks == nil {
		tasks = []models.WorkflowTask{}
	}
	return tasks, total, nil
}

// GetTask retrieves a single workflow task by ID.
func (s *Service) GetTask(ctx context.Context, id string, tenantID string) (*models.WorkflowTask, error) {
	t, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrTaskNotFound
		}
		return nil, err
	}
	return t, nil
}

// Claim assigns a workflow task to a user and transitions status from pending to assigned.
func (s *Service) Claim(ctx context.Context, id string, tenantID string, assigneeID string, comment *string) (*models.WorkflowTask, error) {
	task, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrTaskNotFound
		}
		return nil, err
	}
	if task.Status != "pending" {
		return nil, ErrTaskInvalidStatus
	}
	if err := s.repo.Claim(ctx, id, tenantID, assigneeID, comment); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, id, tenantID)
}

// Complete transitions a workflow task to completed status with optional formData and comment.
func (s *Service) Complete(ctx context.Context, id string, tenantID string, comment *string, formData *string) (*models.WorkflowTask, error) {
	task, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrTaskNotFound
		}
		return nil, err
	}
	if task.Status == "completed" {
		return nil, ErrTaskAlreadyCompleted
	}
	if task.Status == "cancelled" {
		return nil, ErrTaskCancelled
	}
	if err := s.repo.Complete(ctx, id, tenantID, comment, formData); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, id, tenantID)
}

// Errors
var (
	ErrTaskNotFound         = errors.New("workflow task not found")
	ErrTaskInvalidStatus    = errors.New("workflow task is not in pending status")
	ErrTaskAlreadyCompleted = errors.New("workflow task is already completed")
	ErrTaskCancelled        = errors.New("workflow task has been cancelled")
)

// IsNotFound returns true if the error indicates a not-found condition.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrTaskNotFound)
}
