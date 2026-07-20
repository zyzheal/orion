package repository

import (
	"context"
	"orion/platform-svc-go/internal/apk-upload-history/models"
)


// RepositoryInterface defines the data access contract for the apk-upload-history module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	EnsureTable(ctx context.Context) error
	Create(ctx context.Context, tenantID string, m *models.ApkUploadRecord) error
	GetByID(ctx context.Context, tenantID, id string) (*models.ApkUploadRecord, error)
	List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ApkUploadRecord, int, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.ApkUploadRecord, error)
	Delete(ctx context.Context, tenantID, id string) error
	RecentFailures(ctx context.Context, tenantID string, limit int) ([]models.ApkUploadRecord, error)
	Stats(ctx context.Context, tenantID string) (*models.ApkUploadStats, error)
	ExistsByVersion(ctx context.Context, tenantID, market, packageName, version string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
