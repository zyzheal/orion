package service

import (
	"context"
	"orion/platform-svc-go/internal/risk/models"
)

// ServiceInterface defines the interface for the risk service.
type ServiceInterface interface {
	Create(ctx context.Context, tenantID string, req models.CreateRiskRequest) (*models.Risk, error)
	Delete(ctx context.Context, tenantID, id string) error
	Get(ctx context.Context, tenantID, id string) (*models.Risk, error)
	List(ctx context.Context, tenantID string) ([]models.Risk, error)
	Update(ctx context.Context, tenantID, id string, req models.UpdateRiskRequest) (*models.Risk, error)

	// Scoring & heatmap methods.
	CalculateScore(ctx context.Context, req models.RiskScoreRequest) (*models.RiskScore, error)
	GetRiskMatrix(ctx context.Context) (*models.RiskMatrix, error)
	GetHeatmap(ctx context.Context, tenantID string) (*models.HeatmapResponse, error)
}

// Ensure compile-time safety: *Service implements ServiceInterface.
var _ ServiceInterface = (*Service)(nil)
