package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/platform-svc-go/internal/workflow/models"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/workflow/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Count(ctx context.Context, tenantID string, status *string) (int, error)
	CountExecutionsByWorkflowID(ctx context.Context, workflowID string, tenantID string) (int, error)
	Create(ctx context.Context, wf *models.Workflow) error
	CreateExecution(ctx context.Context, exec *models.WorkflowExecution) error
	Delete(ctx context.Context, id string, tenantID string) (bool, error)
	GetByID(ctx context.Context, id string, tenantID string) (*models.Workflow, error)
	GetExecutionByID(ctx context.Context, id string, tenantID string) (*models.WorkflowExecution, error)
	List(ctx context.Context, tenantID string, status *string, limit, offset int) ([]models.Workflow, error)
	ListExecutionsByWorkflowID(ctx context.Context, workflowID string, tenantID string, limit, offset int) ([]models.WorkflowExecution, error)
	SetEnabled(ctx context.Context, id string, tenantID string, enabled bool) (*models.Workflow, error)
	Update(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Workflow, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Workflow Definitions ---

func (s *Service) List(ctx context.Context, tenantID string, status *string, page, pageSize int) ([]models.Workflow, int, error) {
	offset := (page - 1) * pageSize
	wfs, err := s.repo.List(ctx, tenantID, status, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	if wfs == nil {
		wfs = []models.Workflow{}
	}
	total, err := s.repo.Count(ctx, tenantID, status)
	if err != nil {
		return nil, 0, err
	}
	return wfs, total, nil
}

func (s *Service) Get(ctx context.Context, id string, tenantID string) (*models.Workflow, error) {
	wf, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrWorkflowNotFound
		}
		return nil, err
	}
	return wf, nil
}

func (s *Service) Create(ctx context.Context, req *models.CreateWorkflowRequest, tenantID string, createdBy string) (*models.Workflow, error) {
	wf := &models.Workflow{
		TenantID:  tenantID,
		Name:      req.Name,
		CreatedBy: createdBy,
		Enabled:   true,
		Version:   "1.0",
		Nodes:     "[]",
		Edges:     "[]",
	}
	if req.Description != nil {
		wf.Description = req.Description
	}
	if req.Nodes != nil {
		wf.Nodes = *req.Nodes
	}
	if req.Edges != nil {
		wf.Edges = *req.Edges
	}
	if err := s.repo.Create(ctx, wf); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, wf.ID, tenantID)
}

func (s *Service) Update(ctx context.Context, id string, req *models.UpdateWorkflowRequest, tenantID string) (*models.Workflow, error) {
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Nodes != nil {
		updates["nodes"] = *req.Nodes
	}
	if req.Edges != nil {
		updates["edges"] = *req.Edges
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	wf, err := s.repo.Update(ctx, id, tenantID, updates)
	if err != nil {
		if err == sentinel.NotFound {
			return nil, ErrWorkflowNotFound
		}
		return nil, err
	}
	return wf, nil
}

func (s *Service) Delete(ctx context.Context, id string, tenantID string) (bool, error) {
	return s.repo.Delete(ctx, id, tenantID)
}

func (s *Service) Pause(ctx context.Context, id string, tenantID string) (*models.Workflow, error) {
	wf, err := s.repo.SetEnabled(ctx, id, tenantID, false)
	if err != nil {
		if err == sentinel.NotFound {
			return nil, ErrWorkflowNotFound
		}
		return nil, err
	}
	return wf, nil
}

func (s *Service) Resume(ctx context.Context, id string, tenantID string) (*models.Workflow, error) {
	wf, err := s.repo.SetEnabled(ctx, id, tenantID, true)
	if err != nil {
		if err == sentinel.NotFound {
			return nil, ErrWorkflowNotFound
		}
		return nil, err
	}
	return wf, nil
}

// --- Workflow Executions ---

func (s *Service) Execute(ctx context.Context, workflowID string, tenantID string, triggeredBy string, initialInput string) (*models.WorkflowExecution, error) {
	// Validate workflow exists and is enabled
	wf, err := s.repo.GetByID(ctx, workflowID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrWorkflowNotFound
		}
		return nil, err
	}
	if !wf.Enabled {
		return nil, ErrWorkflowDisabled
	}

	now := time.Now().UTC()
	exec := &models.WorkflowExecution{
		WorkflowID:           workflowID,
		WorkflowDefinitionID: wf.ID,
		Status:               "running",
		Input:                initialInput,
		TriggeredBy:          triggeredBy,
		StartedAt:            &now,
	}
	if exec.Input == "" {
		exec.Input = "{}"
	}
	if err := s.repo.CreateExecution(ctx, exec); err != nil {
		return nil, err
	}
	return s.repo.GetExecutionByID(ctx, exec.ID, tenantID)
}

func (s *Service) ListExecutions(ctx context.Context, workflowID string, tenantID string, page, pageSize int) ([]models.WorkflowExecution, int, error) {
	offset := (page - 1) * pageSize
	execs, err := s.repo.ListExecutionsByWorkflowID(ctx, workflowID, tenantID, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	if execs == nil {
		execs = []models.WorkflowExecution{}
	}
	total, err := s.repo.CountExecutionsByWorkflowID(ctx, workflowID, tenantID)
	if err != nil {
		return nil, 0, err
	}
	return execs, total, nil
}

func (s *Service) GetExecution(ctx context.Context, executionID string, tenantID string) (*models.WorkflowExecution, error) {
	exec, err := s.repo.GetExecutionByID(ctx, executionID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrExecutionNotFound
		}
		return nil, err
	}
	return exec, nil
}

// --- Errors ---

var (
	ErrWorkflowNotFound  = errors.New("workflow not found")
	ErrExecutionNotFound = errors.New("workflow execution not found")
	ErrWorkflowDisabled  = errors.New("workflow is disabled")
)

// IsNotFound returns true if the error is a not-found error.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrWorkflowNotFound) || errors.Is(err, ErrExecutionNotFound)
}

// --- Helpers ---

func nowTimestamp() time.Time {
	return time.Now().UTC()
}

func newUUID() string {
	return uuid.New().String()
}
