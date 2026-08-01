// Package service defines the ServiceInterface for job-processor.
package service

import (
	"context"

	"orion/platform-svc-go/internal/job-processor/models"
)

type ServiceInterface interface {
	Process(ctx context.Context, tenantID string, req *models.CreateOperationRequest, chainID string) (*models.JobOperation, error)
	GetOperation(ctx context.Context, tenantID, id string) (*models.JobOperation, error)
	ListOperations(ctx context.Context, tenantID, chainID string, limit, offset int) (*models.OperationListResponse, error)
	ProcessChain(ctx context.Context, tenantID string, req *models.CreateChainRequest) (*models.JobOperationChain, error)
	ListChains(ctx context.Context, tenantID string, limit, offset int) (*models.ChainListResponse, error)
	CancelChain(ctx context.Context, tenantID, chainID string) (*models.JobOperationChain, error)
}

var _ ServiceInterface = (*Service)(nil)
