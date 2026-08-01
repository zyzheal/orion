// Package service provides the business logic layer for job-processor.
//
// ARCHITECTURE (Clean Architecture):
//   Handler → Service → Processor + Repository
//
// The service coordinates between the Processor (business orchestration)
// and Repository (data access), so the handler never calls either directly.
package service

import (
	"context"

	"orion/platform-svc-go/internal/job-processor/models"
	"orion/platform-svc-go/internal/job-processor/processor"
	"orion/platform-svc-go/internal/job-processor/repository"
)

// Service coordinates the Processor and Repository for job operations.
type Service struct {
	proc *processor.Processor
	repo *repository.Repository
}

func NewService(proc *processor.Processor, repo *repository.Repository) *Service {
	return &Service{proc: proc, repo: repo}
}

func (s *Service) Process(ctx context.Context, tenantID string, req *models.CreateOperationRequest, chainID string) (*models.JobOperation, error) {
	return s.proc.Process(ctx, tenantID, req, chainID)
}

func (s *Service) GetOperation(ctx context.Context, tenantID, id string) (*models.JobOperation, error) {
	return s.proc.GetOperation(ctx, tenantID, id)
}

func (s *Service) ListOperations(ctx context.Context, tenantID, chainID string, limit, offset int) (*models.OperationListResponse, error) {
	return s.proc.ListOperations(ctx, tenantID, chainID, limit, offset)
}

func (s *Service) ProcessChain(ctx context.Context, tenantID string, req *models.CreateChainRequest) (*models.JobOperationChain, error) {
	return s.proc.ProcessChain(ctx, tenantID, req)
}

func (s *Service) ListChains(ctx context.Context, tenantID string, limit, offset int) (*models.ChainListResponse, error) {
	return s.repo.ListChains(ctx, tenantID, limit, offset)
}

func (s *Service) CancelChain(ctx context.Context, tenantID, chainID string) (*models.JobOperationChain, error) {
	return s.proc.CancelChain(ctx, tenantID, chainID)
}
