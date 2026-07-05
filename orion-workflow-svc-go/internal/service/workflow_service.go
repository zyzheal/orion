package service

import (
	"context"
	"errors"
	"time"
	"orion/workflow-svc-go/internal/models"
	"orion/workflow-svc-go/internal/repository"
	"github.com/google/uuid"
)

var ErrWorkflowNotFound = errors.New("workflow not found")

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateWorkflowRequest) (*models.Workflow, error) {
	w := &models.Workflow{ID: uuid.New().String(), TenantID: tenantID, Name: req.Name, Description: req.Description, Steps: models.JSONB(req.Steps), Status: models.WfActive}
	return w, s.repo.Create(ctx, w)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Workflow, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Workflow, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) StartRun(ctx context.Context, tenantID, wfID string) (*models.WorkflowRun, error) {
	if _, err := s.repo.GetByID(ctx, tenantID, wfID); err != nil { return nil, ErrWorkflowNotFound }
	run := &models.WorkflowRun{ID: uuid.New().String(), WorkflowID: wfID, TenantID: tenantID, Status: models.RunRunning, StartedAt: time.Now()}
	return run, s.repo.CreateRun(ctx, run)
}

func (s *Service) GetRun(ctx context.Context, id string) (*models.WorkflowRun, error) {
	return s.repo.GetRun(ctx, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}
