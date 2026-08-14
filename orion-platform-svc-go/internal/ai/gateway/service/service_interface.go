package service

import (
	"context"

	"orion/platform-svc-go/internal/ai/gateway/models"
)

type ServiceInterface interface {
	RecordRequest(ctx context.Context, tenantID string, req *models.GatewayRequest) (*models.GatewayResponse, error)
	ProcessRequest(ctx context.Context, tenantID string, req *models.GatewayRequest) (*models.GatewayResponse, error)
	GetRequest(ctx context.Context, tenantID, id string) (*models.GatewayResponse, error)
	ListRequests(ctx context.Context, tenantID string, q models.ListQuery) ([]models.GatewayResponse, int, error)
	ListByProvider(ctx context.Context, tenantID, provider string, limit int) ([]models.GatewayResponse, int, error)
	ListRecent(ctx context.Context, tenantID string, n int) ([]models.GatewayResponse, int, error)
	GetByModel(ctx context.Context, tenantID, model string) ([]models.GatewayResponse, int, error)
	Chat(ctx context.Context, req *models.ChatRequest) (*models.ChatResponse, error)
	ListModels() []models.ProviderModel
}

var _ ServiceInterface = (*Service)(nil)
