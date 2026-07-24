package repository

import (
	"context"
	"orion/platform-svc-go/internal/config/models"
)


// RepositoryInterface defines the data access contract for the config module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, c *models.Config) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Config, error)
	List(ctx context.Context, tenantID string, filter ConfigFilter) ([]models.Config, int, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]any) error
	SoftDelete(ctx context.Context, tenantID, id string) error
	CreateVersion(ctx context.Context, v *models.ConfigVersion) error
	GetVersions(ctx context.Context, configID string) ([]models.ConfigVersion, error)
	GetVersion(ctx context.Context, configID, version string) (*models.ConfigVersion, error)
	CreateGitOps(ctx context.Context, m *models.GitOpsConfig) error
	ListGitOpsConfigs(ctx context.Context, tenantID string) ([]models.GitOpsConfig, error)
	GetGitOpsConfig(ctx context.Context, tenantID, id string) (*models.GitOpsConfig, error)
	UpdateGitOpsStatus(ctx context.Context, tenantID, id string, status string) error
	RecordSyncStatus(ctx context.Context, s *models.GitOpsSyncStatus) error
	GetSyncStatus(ctx context.Context, tenantID string, limit int) ([]models.GitOpsSyncStatus, error)
	CreateChangeRequest(ctx context.Context, m *models.ChangeRequest) error
	ListChangeRequests(ctx context.Context, tenantID string, status string, limit, offset int) ([]models.ChangeRequest, int, error)
	GetChangeRequest(ctx context.Context, tenantID, id string) (*models.ChangeRequest, error)
	UpdateChangeRequestStatus(ctx context.Context, tenantID, id string, status string, approvedBy string, reason string) error
	CreateAuditEntry(ctx context.Context, a *models.AuditEntry) error
	GetAuditTrail(ctx context.Context, configID string, limit int) ([]models.AuditEntry, error)
	CreateTemplate(ctx context.Context, t *models.ConfigTemplate) error
	ListTemplates(ctx context.Context, tenantID string) ([]models.ConfigTemplate, error)
	GetTemplate(ctx context.Context, tenantID, id string) (*models.ConfigTemplate, error)
	UpdateTemplate(ctx context.Context, tenantID string, t *models.ConfigTemplate) error
	DeleteTemplate(ctx context.Context, tenantID, id string) error
	CreateTemplateVersion(ctx context.Context, v *models.ConfigTemplateVersion) error
	ListTemplateVersions(ctx context.Context, templateID string) ([]models.ConfigTemplateVersion, error)
	CreateCanary(ctx context.Context, m *models.CanaryDeployment) error
	GetCanary(ctx context.Context, tenantID, id string) (*models.CanaryDeployment, error)
	UpdateCanaryStatus(ctx context.Context, tenantID, id string, status string) error
	CreateSnapshot(ctx context.Context, s *models.ConfigSnapshot) error
	ListSnapshots(ctx context.Context, tenantID, configID string) ([]models.ConfigSnapshot, error)
	GetSnapshot(ctx context.Context, tenantID, snapshotID string) (*models.ConfigSnapshot, error)
	DeleteSnapshot(ctx context.Context, tenantID, id string) error
	GetEnvironments(ctx context.Context, tenantID string) ([]string, error)
	GetConfigByKeyEnv(ctx context.Context, tenantID, key, environment string) (*models.Config, error)
	CreateWebhook(ctx context.Context, m *models.ConfigWebhook) error
	ListWebhooks(ctx context.Context, tenantID string) ([]models.ConfigWebhook, error)
	GetWebhook(ctx context.Context, tenantID, id string) (*models.ConfigWebhook, error)
	UpdateWebhook(ctx context.Context, tenantID string, m *models.ConfigWebhook) error
	DeleteWebhook(ctx context.Context, tenantID, id string) error
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
