package service

import (
	"context"
	"orion/platform-svc-go/internal/oci-registry/models"
)

type ServiceInterface interface {
	ToggleRegistry(ctx context.Context, tenantID, registryID string, req *models.ToggleRegistryRequest) (*models.OciRegistry, error)
	ListTags(ctx context.Context, tenantID, registryID, repoName string, q *models.TagsQuery) (*models.TagsResponse, error)
	DeleteImage(ctx context.Context, tenantID, registryID, name, digest string) error
	Create(ctx context.Context, tenantID string, req models.CreateOciRegistryRequest) (*models.OciRegistry, error)
	Get(ctx context.Context, tenantID, id string) (*models.OciRegistry, error)
	List(ctx context.Context, tenantID string) ([]models.OciRegistry, error)
	Update(ctx context.Context, tenantID, id string, req models.UpdateOciRegistryRequest) (*models.OciRegistry, error)
	Delete(ctx context.Context, tenantID, id string) error
}

var _ ServiceInterface = (*Service)(nil)
