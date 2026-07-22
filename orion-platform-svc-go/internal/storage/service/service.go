package service

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/storage/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, entity *models.StorageEntry) error
	GetByID(ctx context.Context, id, tenantID string) (*models.StorageEntry, error)
	GetByBucketAndKey(ctx context.Context, bucket, key, tenantID string) (*models.StorageEntry, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.StorageEntry, error)
	Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.StorageEntry, error)
	Delete(ctx context.Context, id, tenantID string) (bool, error)
	DeleteByBucketAndKey(ctx context.Context, bucket, key, tenantID string) (bool, error)
}

// Service handles object storage metadata operations.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a new object storage service.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// Create registers a new storage entry.
func (s *Service) Create(ctx context.Context, tenantID string, bucket, key, provider string) (*models.StorageEntry, error) {
	entry := &models.StorageEntry{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		Bucket:   bucket,
		Key:      key,
		Provider: provider,
		Size:     0,
	}
	if err := s.repo.Create(ctx, entry); err != nil {
		return nil, err
	}
	return entry, nil
}

// GetByID retrieves a storage entry by ID.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.StorageEntry, error) {
	return s.repo.GetByID(ctx, id, tenantID)
}

// GetByBucketAndKey retrieves a storage entry by bucket and key.
func (s *Service) GetByBucketAndKey(ctx context.Context, tenantID, bucket, key string) (*models.StorageEntry, error) {
	return s.repo.GetByBucketAndKey(ctx, bucket, key, tenantID)
}

// List retrieves all storage entries for a tenant.
func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]models.StorageEntry, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	return s.repo.List(ctx, tenantID, limit, offset)
}

// Update modifies a storage entry.
func (s *Service) Update(ctx context.Context, tenantID, id string, key *string) (*models.StorageEntry, error) {
	attrs := make(map[string]interface{})
	if key != nil {
		attrs["key"] = *key
	}
	attrs["updated_at"] = time.Now().UTC()
	return s.repo.Update(ctx, id, tenantID, attrs)
}

// Delete removes a storage entry by ID.
func (s *Service) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.Delete(ctx, id, tenantID)
}

// DeleteByBucketAndKey removes a storage entry by bucket and key.
func (s *Service) DeleteByBucketAndKey(ctx context.Context, tenantID, bucket, key string) (bool, error) {
	return s.repo.DeleteByBucketAndKey(ctx, bucket, key, tenantID)
}
