package service

import (
	"context"
	"database/sql"
	"time"

	"orion/finops-svc-go/internal/finops/models"
	"orion/finops-svc-go/internal/finops/repository"
)

// AnalysisService provides ROI analysis, cost comparisons, and report generation.
type AnalysisService struct {
	repo *repository.CostRepository
}

func NewAnalysisService(repo *repository.CostRepository) *AnalysisService {
	return &AnalysisService{repo: repo}
}

// ==================== Cost Records ====================

// RecordEntityCost records an entity-level cost.
func (s *AnalysisService) RecordEntityCost(ctx context.Context, entityType, entityID string, amount float64, category string, environment, tags, currency string, ts time.Time) (string, error) {
	if ts.IsZero() {
		ts = time.Now()
	}
	if currency == "" {
		currency = "USD"
	}

	rec := repository.EntityCostRecord{
		EntityType:  entityType,
		EntityID:    entityID,
		Amount:      amount,
		Category:    category,
		Environment: sql.NullString{String: environment, Valid: environment != ""},
		Tags:        sql.NullString{String: tags, Valid: tags != ""},
		Currency:    currency,
		Timestamp:   ts,
	}
	if err := s.repo.CreateEntityCostRecord(ctx, &rec); err != nil {
		return "", err
	}
	return rec.ID, nil
}

// GetEntityCostSummary returns cost summary for an entity.
func (s *AnalysisService) GetEntityCostSummary(ctx context.Context, entityType, entityID string, periodStart, periodEnd time.Time) (*repository.EntityCostSummary, error) {
	return s.repo.GetEntityCostSummary(ctx, entityType, entityID, periodStart, periodEnd)
}

// GetCostTrendForEntity returns cost trend for an entity.
func (s *AnalysisService) GetCostTrendForEntity(ctx context.Context, entityType, entityID string, periodStart, periodEnd time.Time) ([]models.CostTrendPoint, error) {
	return s.repo.GetEntityCostTrend(ctx, entityType, entityID, periodStart, periodEnd)
}

// GetCostRecordsByEntity returns cost records for an entity.
func (s *AnalysisService) GetCostRecordsByEntity(ctx context.Context, entityType, entityID string, periodStart, periodEnd time.Time) ([]repository.EntityCostRecord, error) {
	return s.repo.GetEntityCostByEntity(ctx, entityType, entityID, periodStart, periodEnd)
}

// GetAllCostRecords returns all cost records with optional filters.
func (s *AnalysisService) GetAllCostRecords(ctx context.Context, entityType, entityID, category string, periodStart, periodEnd time.Time) ([]repository.EntityCostRecord, error) {
	return s.repo.GetAllEntityCostRecords(ctx, entityType, entityID, category, periodStart, periodEnd)
}

// ==================== Reports ====================

// GenerateReport generates a cost report.
func (s *AnalysisService) GenerateReport(ctx context.Context, tenantID, period string, totalCost float64, breakdown map[string]float64) (interface{}, error) {
	if breakdown == nil {
		breakdown = make(map[string]float64)
	}
	rep, err := s.repo.CreateReport(ctx, tenantID, period, totalCost, breakdown)
	if err != nil {
		return nil, err
	}
	return rep, nil
}

// GetReports returns report history for a tenant.
func (s *AnalysisService) GetReports(ctx context.Context, tenantID string, limit int) ([]repository.FinOpsReport, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.GetReports(ctx, tenantID, limit)
}

// ==================== ROI ====================

// CreateROIAnalysis creates an ROI analysis record.
func (s *AnalysisService) CreateROIAnalysis(ctx context.Context, req models.CreateROIRequest) (interface{}, error) {
	return s.repo.CreateROIAnalysis(ctx, req)
}

// GetROIHistory returns ROI analysis history.
func (s *AnalysisService) GetROIHistory(ctx context.Context, investmentType string, minROI float64) ([]repository.ROIAnalysisRecord, error) {
	return s.repo.GetROIHistory(ctx, investmentType, minROI)
}

// GetROISummary returns aggregated ROI statistics.
func (s *AnalysisService) GetROISummary(ctx context.Context) (*repository.ROISummary, error) {
	return s.repo.GetROISummary(ctx)
}

// ==================== Cost Comparisons ====================

// CreateCostComparison creates a cost comparison.
func (s *AnalysisService) CreateCostComparison(ctx context.Context, req models.CreateCostComparisonRequest) (interface{}, error) {
	return s.repo.CreateCostComparison(ctx, req)
}

// GetCostComparisons returns all cost comparisons.
func (s *AnalysisService) GetCostComparisons(ctx context.Context) ([]repository.CostComparisonRecord, error) {
	return s.repo.GetCostComparisons(ctx)
}

// ==================== Chargeback ====================

// GenerateChargebackReport generates a chargeback report.
func (s *AnalysisService) GenerateChargebackReport(ctx context.Context, tenantID string, periodStart, periodEnd time.Time) (*repository.ChargebackReport, error) {
	return s.repo.GetChargebackReport(ctx, tenantID, periodStart, periodEnd)
}

// ==================== Cost Breakdown ====================

// GetCostBreakdown returns cost breakdown by dimension.
func (s *AnalysisService) GetCostBreakdown(ctx context.Context, tenantID, dimension string, periodStart, periodEnd time.Time) ([]repository.CostBreakdown, error) {
	return s.repo.GetCloudCostBreakdown(ctx, tenantID, dimension, periodStart, periodEnd)
}

// ==================== Legacy Budget Alerts ====================

// CreateLegacyBudgetAlert creates a legacy budget alert.
func (s *AnalysisService) CreateLegacyBudgetAlert(ctx context.Context, tenantID string, req *models.LegacyBudgetAlert) error {
	req.ID = "gen-uuid" // simplified; in production use uuid
	if req.Currency == "" {
		req.Currency = "USD"
	}
	if req.Period == "" {
		req.Period = "monthly"
	}
	req.TenantID = tenantID
	return s.repo.CreateLegacyBudgetAlert(ctx, req)
}

// GetLegacyBudgetAlerts returns legacy budget alerts.
func (s *AnalysisService) GetLegacyBudgetAlerts(ctx context.Context, tenantID, environment string) ([]models.LegacyBudgetAlert, error) {
	return s.repo.GetLegacyBudgetAlerts(ctx, tenantID, environment)
}

// DeleteLegacyBudgetAlert deletes a legacy budget alert.
func (s *AnalysisService) DeleteLegacyBudgetAlert(ctx context.Context, id string) error {
	return s.repo.DeleteLegacyBudgetAlert(ctx, id)
}
