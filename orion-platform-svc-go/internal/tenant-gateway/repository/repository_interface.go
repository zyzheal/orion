package repository

import (
	"context"
	"orion/platform-svc-go/internal/tenant-gateway/models"
)

// RepositoryInterface defines the data access contract.
type RepositoryInterface interface {
	Create(ctx context.Context, tenant *models.Tenant) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Tenant, error)
	GetByName(ctx context.Context, tenantID, name string) (*models.Tenant, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	SoftDelete(ctx context.Context, tenantID, id string) error
	List(ctx context.Context, tenantID string, q models.ListQuery) (*models.TenantListResponse, error)
	// Quota methods.
	GetQuota(ctx context.Context, tenantID, tenantKey string) (*models.TenantQuota, error)
	CreateQuota(ctx context.Context, tenantID, tenantKey string, quota *models.TenantQuota) error
	UpdateQuota(ctx context.Context, tenantID, tenantKey string, updates map[string]interface{}) error
}
