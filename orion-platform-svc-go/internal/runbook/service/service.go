package service

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/runbook/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, m *models.Runbook) error
	CreateExecution(ctx context.Context, tenantID string, ex *models.RunbookExecution) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Runbook, error)
	List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.Runbook, int, error)
	ListExecutions(ctx context.Context, tenantID, runbookID string, limit int) ([]models.RunbookExecution, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Runbook, error)
	UpdateExecutionStatus(ctx context.Context, tenantID, executionID string, status string) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateRunbookRequest) (*models.Runbook, error) {
	if req.Title == "" {
		return nil, errors.New("title is required")
	}
	m := &models.Runbook{
		TenantID:    tenantID,
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		Severity:    req.Severity,
		Steps:       req.Steps,
		Tags:        req.Tags,
		Owner:       req.Owner,
		Enabled:     true,
	}
	if m.Severity == "" {
		m.Severity = "medium"
	}
	if err := s.repo.Create(ctx, tenantID, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Runbook, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.Runbook, int, error) {
	return s.repo.List(ctx, tenantID, q)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateRunbookRequest) (*models.Runbook, error) {
	updates := make(map[string]interface{})
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}
	if req.Severity != nil {
		updates["severity"] = *req.Severity
	}
	if req.Steps != nil {
		updates["steps"] = req.Steps
	}
	if req.Tags != nil {
		updates["tags"] = req.Tags
	}
	if req.Owner != nil {
		updates["owner"] = *req.Owner
	}
	if req.Approved != nil {
		updates["approved"] = *req.Approved
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	return s.repo.Update(ctx, tenantID, id, updates)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) CreateExecution(ctx context.Context, tenantID, runbookID string, req models.CreateRunbookExecutionRequest) (*models.RunbookExecution, error) {
	_, err := s.repo.GetByID(ctx, tenantID, runbookID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	ex := &models.RunbookExecution{
		RunbookID:  runbookID,
		IncidentID: req.IncidentID,
		ExecutorID: req.ExecutorID,
		Status:     "running",
	}
	if err := s.repo.CreateExecution(ctx, tenantID, ex); err != nil {
		return nil, err
	}
	return ex, nil
}

func (s *Service) ListExecutions(ctx context.Context, tenantID, runbookID string) ([]models.RunbookExecution, error) {
	return s.repo.ListExecutions(ctx, tenantID, runbookID, 50)
}

func (s *Service) CompleteExecution(ctx context.Context, tenantID, executionID string, success bool) error {
	status := "completed"
	if !success {
		status = "failed"
	}
	return s.repo.UpdateExecutionStatus(ctx, tenantID, executionID, status)
}
