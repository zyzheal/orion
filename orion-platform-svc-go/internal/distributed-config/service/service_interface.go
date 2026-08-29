// DO NOT EDIT. Generated for handler DI.
package service

import (
	"context"
	"orion/platform-svc-go/internal/distributed-config/models"
)

type ServiceInterface interface {
	CreateNamespace(ctx context.Context, req *models.CreateNamespaceRequest, tenantID string) (*models.ConfigNamespace, error)
	GetNamespace(ctx context.Context, id, tenantID string) (*models.ConfigNamespace, error)
	ListNamespaces(ctx context.Context, tenantID string) ([]models.ConfigNamespace, error)
	CreateGroup(ctx context.Context, req *models.CreateGroupRequest, tenantID string) (*models.ConfigGroup, error)
	GetGroup(ctx context.Context, id, tenantID string) (*models.ConfigGroup, error)
	ListGroups(ctx context.Context, tenantID, namespaceID string) ([]models.ConfigGroup, error)
	CreateItem(ctx context.Context, req *models.CreateItemRequest, tenantID string) (*models.ConfigItem, error)
	GetItem(ctx context.Context, id, tenantID string) (*models.ConfigItem, error)
	ListItems(ctx context.Context, tenantID string, filter *models.GetItemsFilter) ([]models.ConfigItem, error)
	UpdateItem(ctx context.Context, id, tenantID, operator string, req *models.UpdateItemRequest) (*models.ConfigItem, error)
	DeleteItem(ctx context.Context, id, tenantID string) (bool, error)
	GetItemHistory(ctx context.Context, itemID, tenantID string) ([]models.ConfigItemHistory, error)
	PublishSnapshot(ctx context.Context, groupID, environment, operator string, tenantID string) (*models.ConfigSnapshot, error)
	ListSnapshots(ctx context.Context, tenantID, groupID, environment string) ([]models.ConfigSnapshot, error)
	GetSnapshotData(ctx context.Context, id string) (map[string]interface{}, error)
	PublishRelease(ctx context.Context, req *models.PublishReleaseRequest, tenantID string) (*models.ConfigRelease, error)
	RollbackRelease(ctx context.Context, req *models.RollbackReleaseRequest, tenantID string) (*models.ConfigRelease, error)
	GetRelease(ctx context.Context, id, tenantID string) (*models.ConfigRelease, error)
	ListReleases(ctx context.Context, tenantID string, filter *models.GetReleasesFilter) ([]models.ConfigRelease, error)
	GetReleaseHistory(ctx context.Context, releaseID, tenantID string) ([]models.ConfigReleaseHistory, error)
	ListAudit(ctx context.Context, tenantID string, limit int) ([]models.ConfigAudit, error)
}

var _ ServiceInterface = (*Service)(nil)
