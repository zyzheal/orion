package repository

import (
	"context"
	"orion/platform-svc-go/internal/cost-allocation/models"
)


// RepositoryInterface defines the data access contract for the cost-allocation module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateAllocation(ctx context.Context, a *models.Allocation) error
	GetAllocationByID(ctx context.Context, tenantID, id string) (*models.Allocation, error)
	ListAllocations(ctx context.Context, tenantID string, filter *models.AllocationFilter) ([]models.Allocation, error)
	UpdateAllocation(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Allocation, error)
	DeleteAllocation(ctx context.Context, tenantID, id string) (bool, error)
	CreateRule(ctx context.Context, rule *models.Rule) error
	ListRulesByAllocation(ctx context.Context, tenantID, allocationID string) ([]models.Rule, error)
	DeleteRule(ctx context.Context, tenantID, ruleID string) (bool, error)
	CreateReport(ctx context.Context, report *models.Report) error
	GetReportByID(ctx context.Context, tenantID, id string) (*models.Report, error)
	ListReports(ctx context.Context, tenantID string, filter *models.ReportFilter) ([]models.Report, error)
	UpdateReport(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Report, error)
	DeleteReport(ctx context.Context, tenantID, id string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
