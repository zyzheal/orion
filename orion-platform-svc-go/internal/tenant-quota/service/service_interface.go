// DO NOT EDIT. Generated for handler DI.
package service

import (
	"context"
	"orion/platform-svc-go/internal/tenant-quota/models"
)

type ServiceInterface interface {
	CreatePlan(ctx context.Context, req *models.CreatePlanRequest, tenantID string) (*models.QuotaPlan, error)
	GetPlan(ctx context.Context, id, tenantID string) (*models.QuotaPlan, error)
	ListPlans(ctx context.Context, tenantID string) ([]models.QuotaPlan, error)
	UpdatePlan(ctx context.Context, id, tenantID string, req *models.UpdatePlanRequest) (*models.QuotaPlan, error)
	DeletePlan(ctx context.Context, id, tenantID string) (bool, error)
	GetUsage(ctx context.Context, tenantID, metric string) (*models.QuotaUsage, error)
	ListUsage(ctx context.Context, tenantID string) ([]models.QuotaUsageWithLimit, error)
	IncrementUsage(ctx context.Context, req *models.IncrementUsageRequest, tenantID string) (*models.QuotaUsageWithLimit, error)
	ResetUsage(ctx context.Context, tenantID string) error
	CheckQuota(ctx context.Context, tenantID, metric string, amount int64) (*models.QuotaCheckResult, error)
	ListAlerts(ctx context.Context, tenantID string) ([]models.QuotaAlert, error)
}

var _ ServiceInterface = (*Service)(nil)