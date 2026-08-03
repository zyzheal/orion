package repository

import (
	"context"
	"orion/platform-svc-go/internal/ai/degradation/models"
)


// RepositoryInterface defines the data access contract for the ai-degradation module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateConfig(ctx context.Context, config *models.DegradationConfig) error
	GetConfig(ctx context.Context, tenantID, configID string) (*models.DegradationConfig, error)
	UpdateConfig(ctx context.Context, tenantID, configID string, name *string, description *string, triggers *string, actions *string, recovery *string, metadata *string) (*models.DegradationConfig, error)
	UpdateConfigStatus(ctx context.Context, tenantID, configID string, enabled bool, status models.DegradationStatus) (*models.DegradationConfig, error)
	UpdateConfigTriggered(ctx context.Context, tenantID, configID string, triggeredAt int64) error
	UpdateConfigRecovered(ctx context.Context, tenantID, configID string) error
	DeleteConfig(ctx context.Context, tenantID, configID string) error
	ListConfigs(ctx context.Context, tenantID string, q models.ListConfigsQuery) (*models.ConfigListResponse, error)
	CreateHistory(ctx context.Context, history *models.DegradationHistory) error
	UpdateHistoryRecovered(ctx context.Context, tenantID, historyID string, recoveredAt int64) error
	GetHistoryList(ctx context.Context, tenantID, configID string, q models.ListHistoryQuery) (*models.HistoryListResponse, error)
	GetLatestTriggeredHistory(ctx context.Context, tenantID, configID string) (*models.DegradationHistory, error)
	CountActiveConfigs(ctx context.Context, tenantID string) (int, error)
	CountTotalConfigs(ctx context.Context, tenantID string) (int, error)
	GetServiceSummary(ctx context.Context, tenantID string) ([]ServiceSummary, error)
	SumTriggerCounts(ctx context.Context, tenantID string) (int, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
