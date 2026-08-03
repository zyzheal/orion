package service

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/test-execution-engine/models"
	"orion/platform-svc-go/internal/test-execution-engine/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateExecutionRequest) (*models.TestExecution, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if req.Framework == "" {
		return nil, fmt.Errorf("framework is required")
	}
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.TestExecution, error) {
	return s.repo.Get(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, q models.ListExecutionsQuery) (*models.ExecutionListResponse, error) {
	return s.repo.List(ctx, tenantID, q)
}

func (s *Service) SubmitResults(ctx context.Context, tenantID, id string, req *models.SubmitResultRequest) error {
	exec, err := s.repo.Get(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if exec.Status != models.TestStatusRunning && exec.Status != models.TestStatusPending {
		return fmt.Errorf("execution %s is not in running/pending status", id)
	}
	return s.repo.SubmitResults(ctx, id, req)
}

func (s *Service) Start(ctx context.Context, tenantID, id string) error {
	exec, err := s.repo.Get(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if exec.Status != models.TestStatusPending {
		return fmt.Errorf("execution %s is not in pending status", id)
	}
	return s.repo.UpdateStatus(ctx, id, models.TestStatusRunning)
}

func (s *Service) Cancel(ctx context.Context, tenantID, id string) error {
	exec, err := s.repo.Get(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if exec.Status == models.TestStatusPassed || exec.Status == models.TestStatusFailed {
		return fmt.Errorf("execution %s already completed", id)
	}
	return s.repo.UpdateStatus(ctx, id, models.TestStatusCancelled)
}

func (s *Service) GetSuites(ctx context.Context, executionID string) ([]models.TestSuite, error) {
	return s.repo.GetSuites(ctx, executionID)
}

func (s *Service) GetTestCases(ctx context.Context, suiteID string) ([]models.TestCase, error) {
	return s.repo.GetTestCases(ctx, suiteID)
}