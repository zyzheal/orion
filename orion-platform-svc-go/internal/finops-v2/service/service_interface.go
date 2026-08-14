package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface

import (
	"context"

	"orion/platform-svc-go/internal/finops-v2/models"
)

// ServiceInterface defines the service methods used by the handler.
type ServiceInterface interface {
	TrackProjectCost(ctx context.Context, tenantID string, req models.TrackCostRequest) (*models.CostEntry, error)
	TrackTenantCost(ctx context.Context, tenantID string, req models.TrackCostRequest) (*models.CostEntry, error)
	TrackTeamCost(ctx context.Context, tenantID string, req models.TrackCostRequest) (*models.CostEntry, error)
	GetCostByEntity(ctx context.Context, tenantID, entityType, entityID string) ([]models.CostEntry, error)
	GetEntityCostTrend(ctx context.Context, tenantID, entityType, entityID, period string) (*models.CostTrend, error)
	GetCostSummary(ctx context.Context, tenantID, period string) (*models.CostSummary, error)
	GetCostBreakdown(ctx context.Context, tenantID, dimension string) (*models.CostBreakdownResponse, error)
	GetChargebackReport(ctx context.Context, tenantID string) ([]models.ChargebackEntry, error)
	ListBudgets(ctx context.Context, tenantID string, limit, offset int) ([]models.Budget, error)
	CreateBudget(ctx context.Context, tenantID string, req models.CreateBudgetRequest) (*models.Budget, error)
	GetBudget(ctx context.Context, tenantID, id string) (*models.Budget, error)
	UpdateBudget(ctx context.Context, tenantID, id string, req models.UpdateBudgetRequest) (*models.Budget, error)
	DeleteBudget(ctx context.Context, tenantID, id string) error
	GetBudgetStatus(ctx context.Context, tenantID, id string) (*models.BudgetStatusResponse, error)
	ForecastBudget(ctx context.Context, tenantID, id string) (*models.BudgetForecastResponse, error)
	CheckBudgetAlerts(ctx context.Context, tenantID, entityID, entityType string) ([]models.BudgetAlert, error)
	GetAlertTriggers(ctx context.Context) ([]models.AlertTrigger, error)
	GetCostForecast(ctx context.Context, tenantID, entityType, entityID, period string) (*models.CostForecast, error)
	ListRecommendations(ctx context.Context, tenantID string) ([]models.Recommendation, error)
	UpdateRecommendationStatus(ctx context.Context, tenantID, id string, req models.UpdateRecommendationRequest) error
	DeleteRecommendation(ctx context.Context, tenantID, id string) error
	GetRightSizingRecommendations(ctx context.Context, tenantID string) ([]models.RightSizingRecommendation, error)
	DetectUnusedResources(ctx context.Context, tenantID string) ([]models.UnusedResource, error)
	EstimateSavings(ctx context.Context, tenantID string) (*models.SavingsEstimate, error)
	GetReportHistory(ctx context.Context, tenantID string) ([]models.Report, error)
	GetROIHistory(ctx context.Context, tenantID string) ([]models.ROIEntry, error)
	GetROISummary(ctx context.Context, tenantID string) (*models.ROISummary, error)
	GetMetrics(ctx context.Context, tenantID string) (*models.FinOpsMetricsResponse, error)
	GetRegisteredProviders(ctx context.Context) ([]models.CloudProviderEntry, error)
	SetSchedule(ctx context.Context, provider, cronExpression string, enabled bool) error
	GetSchedule(ctx context.Context, provider string) (*models.CollectionSchedule, error)
	CollectCost(ctx context.Context, tenantID string, req models.CollectCostRequest) (*models.CollectCostResponse, error)
	HealthCheck(ctx context.Context) (bool, error)
}
