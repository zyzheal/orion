package service

import (
	"context"

	"orion/platform-svc-go/internal/job-processor/models"
	"orion/platform-svc-go/internal/job-processor/repository"
)

type JobProcessorService struct {
	repo *repository.Repository
}

func NewJobProcessorService(repo *repository.Repository) *JobProcessorService {
	return &JobProcessorService{repo: repo}
}

func (s *JobProcessorService) CreateChain(ctx context.Context, tenantID, name string) (*models.JobOperationChain, error) {
	return s.repo.CreateChain(ctx, tenantID, name)
}

func (s *JobProcessorService) GetChain(ctx context.Context, tenantID, id string) (*models.JobOperationChain, error) {
	return s.repo.GetChain(ctx, tenantID, id)
}

func (s *JobProcessorService) UpdateChain(ctx context.Context, tenantID, id string, fields map[string]interface{}) (*models.JobOperationChain, error) {
	return s.repo.UpdateChain(ctx, tenantID, id, fields)
}

func (s *JobProcessorService) ListChains(ctx context.Context, tenantID string, limit, offset int) (*models.ChainListResponse, error) {
	return s.repo.ListChains(ctx, tenantID, limit, offset)
}

func (s *JobProcessorService) CreateOperation(ctx context.Context, op *models.JobOperation) error {
	return s.repo.CreateOperation(ctx, op)
}

func (s *JobProcessorService) GetOperation(ctx context.Context, tenantID, id string) (*models.JobOperation, error) {
	return s.repo.GetOperation(ctx, tenantID, id)
}

func (s *JobProcessorService) ListOperations(ctx context.Context, tenantID, chainID string, limit, offset int) (*models.OperationListResponse, error) {
	return s.repo.ListOperations(ctx, tenantID, chainID, limit, offset)
}

func (s *JobProcessorService) UpdateStatus(ctx context.Context, tenantID, id string, status string, resultJSON string, errMsg string) error {
	return s.repo.UpdateStatus(ctx, tenantID, id, status, resultJSON, errMsg)
}
