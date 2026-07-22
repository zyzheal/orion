package repository

import (
	"context"
	"orion/platform-svc-go/internal/approval/models"
)


// RepositoryInterface defines the data access contract for the approval module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateApprovalRequest(ctx context.Context, m *models.ApprovalRequest) error
	GetApprovalRequest(ctx context.Context, tenantID, id string) (*models.ApprovalRequest, error)
	ListApprovalRequests(ctx context.Context, tenantID, approvalType, status string, limit, offset int) ([]models.ApprovalRequest, error)
	UpdateApprovalRequest(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteApprovalRequest(ctx context.Context, tenantID, id string) error
	CreateApprovalLevel(ctx context.Context, m *models.ApprovalLevel) error
	ListLevelsByApproval(ctx context.Context, tenantID, approvalID string) ([]models.ApprovalLevel, error)
	CreateApprovalHistory(ctx context.Context, m *models.ApprovalHistory) error
	ListHistoryByApproval(ctx context.Context, tenantID, approvalID string) ([]models.ApprovalHistory, error)
	CreateTemplate(ctx context.Context, m *models.ApprovalTemplate) error
	GetTemplate(ctx context.Context, tenantID, id string) (*models.ApprovalTemplate, error)
	ListTemplates(ctx context.Context, tenantID string, limit, offset int) ([]models.ApprovalTemplate, error)
	UpdateTemplate(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteTemplate(ctx context.Context, tenantID, id string) error
	CreateApprovalGate(ctx context.Context, m *models.ApprovalGate) error
	ListGatesByRun(ctx context.Context, tenantID, runID string) ([]models.ApprovalGate, error)
	GetGateByStage(ctx context.Context, tenantID, runID, stageID string) (*models.ApprovalGate, error)
	GetStatistics(ctx context.Context, tenantID string) (models.ApprovalStatistics, error)
	ListPending(ctx context.Context, tenantID string) ([]models.ApprovalRequest, error)
	ListMyPending(ctx context.Context, tenantID, userID string) ([]models.ApprovalRequest, error)
	GetByStatus(ctx context.Context, tenantID, approvalID string) (*models.ApprovalRequest, error)
	GetDailyTrend(ctx context.Context, tenantID string, days int) ([]models.ApprovalTrendEntry, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
