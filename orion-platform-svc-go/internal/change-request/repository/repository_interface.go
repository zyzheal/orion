package repository

import (
	"time"
	"context"
	"orion/platform-svc-go/internal/change-request/models"
)


// RepositoryInterface defines the data access contract for the change-request module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateRequest(ctx context.Context, req *models.ChangeRequest) error
	GetRequestByID(ctx context.Context, id string, tenantID string) (*models.ChangeRequest, error)
	ListRequests(ctx context.Context, tenantID string, filters *models.ListChangeRequestRequest) ([]models.ChangeRequest, error)
	UpdateRequest(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.ChangeRequest, error)
	DeleteRequest(ctx context.Context, id string, tenantID string) (bool, error)
	UpdateRequestStatus(ctx context.Context, id string, tenantID string, status string) (*models.ChangeRequest, error)
	CreateApproval(ctx context.Context, approval *models.ChangeApproval) error
	GetApprovalChain(ctx context.Context, requestID string, tenantID string) ([]models.ChangeApproval, error)
	GetApproval(ctx context.Context, approvalID string, requestID string, tenantID string) (*models.ChangeApproval, error)
	UpdateApprovalDecision(ctx context.Context, approvalID string, tenantID string, decision string, comments *string) (*models.ChangeApproval, error)
	CreateExecution(ctx context.Context, execution *models.ExecutionStep) error
	GetExecutionProgress(ctx context.Context, requestID string, tenantID string) ([]models.ExecutionStep, error)
	UpdateExecutionStep(ctx context.Context, stepID string, tenantID string, status string, result map[string]any, startedAt *time.Time, completedAt *time.Time) (*models.ExecutionStep, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
