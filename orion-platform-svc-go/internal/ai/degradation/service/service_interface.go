package service

import (
	"context"
	"orion/platform-svc-go/internal/ai/degradation/models"
)

type ServiceInterface interface {
	CreateConfig(ctx context.Context, tenantID string, req models.CreateDegradationConfigRequest) (*models.DegradationConfig, error)
	GetConfig(ctx context.Context, tenantID, configID string) (*models.DegradationConfig, error)
	ListConfigs(ctx context.Context, tenantID string, q models.ListConfigsQuery) (*models.ConfigListResponse, error)
	UpdateConfig(ctx context.Context, tenantID, configID string, req models.UpdateDegradationConfigRequest) (*models.DegradationConfig, error)
	DeleteConfig(ctx context.Context, tenantID, configID string) error
	EnableConfig(ctx context.Context, tenantID, configID string) (*models.DegradationConfig, error)
	DisableConfig(ctx context.Context, tenantID, configID string) (*models.DegradationConfig, error)
	TriggerDegradation(ctx context.Context, tenantID, configID string, req models.TriggerDegradationRequest) (*models.DegradationHistory, error)
	RecoverService(ctx context.Context, tenantID, configID string) (*models.DegradationConfig, error)
	GetHistory(ctx context.Context, tenantID, configID string, q models.ListHistoryQuery) (*models.HistoryListResponse, error)
	GetGlobalStatus(ctx context.Context, tenantID string) (*models.GlobalDegradationStatus, error)
}

var _ ServiceInterface = (*DegradationService)(nil)
