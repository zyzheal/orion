package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"orion/finops-svc-go/internal/finops/models"

	"github.com/google/uuid"
)

// ==================== Entity Cost Records (finops_cost_records) ====================

// EntityCostRecord models cost tracking per entity (project/tenant/team).
type EntityCostRecord struct {
	ID          string             `db:"id" json:"id"`
	EntityType  string             `db:"entity_type" json:"entity_type"`
	EntityID    string             `db:"entity_id" json:"entity_id"`
	Amount      float64            `db:"amount" json:"amount"`
	Category    string             `db:"category" json:"category"`
	Environment sql.NullString     `db:"environment" json:"environment,omitempty"`
	Tags        sql.NullString     `db:"tags" json:"tags,omitempty"`
	Currency    string             `db:"currency" json:"currency"`
	Timestamp   time.Time          `db:"timestamp" json:"timestamp"`
}

// CreateEntityCostRecord inserts an entity-level cost record.
func (r *CostRepository) CreateEntityCostRecord(ctx context.Context, rec *EntityCostRecord) error {
	rec.ID = uuid.New().String()
	query := `INSERT INTO finops_cost_records (id, entity_type, entity_id, amount, category, environment, tags, currency, timestamp)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`
	_, err := r.db.ExecContext(ctx, query, rec.ID, rec.EntityType, rec.EntityID, rec.Amount, rec.Category, rec.Environment, rec.Tags, rec.Currency, rec.Timestamp)
	return err
}

// GetEntityCostByEntity retrieves cost records for a given entity within a period.
func (r *CostRepository) GetEntityCostByEntity(ctx context.Context, entityType, entityId string, periodStart, periodEnd time.Time) ([]EntityCostRecord, error) {
	var records []EntityCostRecord
	query := `SELECT * FROM finops_cost_records WHERE entity_type=$1 AND entity_id=$2 AND timestamp>=$3 AND timestamp<=$4 ORDER BY timestamp DESC`
	err := r.db.SelectContext(ctx, &records, query, entityType, entityId, periodStart, periodEnd)
	return records, err
}

// GetEntityCostTrend retrieves daily aggregated cost trend for an entity.
func (r *CostRepository) GetEntityCostTrend(ctx context.Context, entityType, entityId string, periodStart, periodEnd time.Time) ([]models.CostTrendPoint, error) {
	query := `
		SELECT DATE(timestamp) as date, COALESCE(SUM(amount),0) as cost_cents
		FROM finops_cost_records
		WHERE entity_type=$1 AND entity_id=$2 AND timestamp>=$3 AND timestamp<=$4
		GROUP BY DATE(timestamp)
		ORDER BY date`

	rows, err := r.db.QueryContext(ctx, query, entityType, entityId, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []models.CostTrendPoint
	for rows.Next() {
		var p models.CostTrendPoint
		var date time.Time
		var cost float64
		if err := rows.Scan(&date, &cost); err != nil {
			return nil, err
		}
		p.Date = date.Format("2006-01-02")
		p.CostCents = int64(cost * 100) // store in cents for consistency
		points = append(points, p)
	}

	for i := range points {
		if i > 0 && points[i-1].CostCents > 0 {
			points[i].ChangeRate = float64(points[i].CostCents-points[i-1].CostCents) / float64(points[i-1].CostCents) * 100
		}
	}

	return points, rows.Err()
}

// EntityCostSummary aggregates costs by entity.
type EntityCostSummary struct {
	EntityType  string              `json:"entity_type"`
	EntityID    string              `json:"entity_id"`
	TotalAmount float64             `json:"total_amount"`
	Breakdown   map[string]float64  `json:"breakdown"`
	Period      string              `json:"period"`
	Currency    string              `json:"currency"`
	RecordCount int                 `json:"record_count"`
}

// GetEntityCostSummary computes cost summary for an entity.
func (r *CostRepository) GetEntityCostSummary(ctx context.Context, entityType, entityId string, periodStart, periodEnd time.Time) (*EntityCostSummary, error) {
	var total float64
	err := r.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(amount),0) FROM finops_cost_records WHERE entity_type=$1 AND entity_id=$2 AND timestamp>=$3 AND timestamp<=$4`,
		entityType, entityId, periodStart, periodEnd).Scan(&total)
	if err != nil {
		return nil, err
	}

	var recordCount int
	err = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM finops_cost_records WHERE entity_type=$1 AND entity_id=$2 AND timestamp>=$3 AND timestamp<=$4`,
		entityType, entityId, periodStart, periodEnd).Scan(&recordCount)
	if err != nil {
		return nil, err
	}

	// Breakdown by category
	rows, err := r.db.QueryContext(ctx, `SELECT category, COALESCE(SUM(amount),0) FROM finops_cost_records WHERE entity_type=$1 AND entity_id=$2 AND timestamp>=$3 AND timestamp<=$4 GROUP BY category`,
		entityType, entityId, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	breakdown := make(map[string]float64)
	for rows.Next() {
		var cat string
		var amt float64
		if err := rows.Scan(&cat, &amt); err != nil {
			return nil, err
		}
		breakdown[cat] = amt
	}

	return &EntityCostSummary{
		EntityType:  entityType,
		EntityID:    entityId,
		TotalAmount: total,
		Breakdown:   breakdown,
		Currency:    "USD",
		RecordCount: recordCount,
	}, nil
}

// GetAllEntityCostRecords retrieves all entity cost records with optional filters.
func (r *CostRepository) GetAllEntityCostRecords(ctx context.Context, entityType, entityId, category string, periodStart, periodEnd time.Time) ([]EntityCostRecord, error) {
	query := `SELECT * FROM finops_cost_records WHERE timestamp>=$1 AND timestamp<=$2`
	args := []interface{}{periodStart, periodEnd}
	argIdx := 3

	if entityType != "" {
		query += fmt.Sprintf(` AND entity_type=$%d`, argIdx)
		args = append(args, entityType)
		argIdx++
	}
	if entityId != "" {
		query += fmt.Sprintf(` AND entity_id=$%d`, argIdx)
		args = append(args, entityId)
		argIdx++
	}
	if category != "" {
		query += fmt.Sprintf(` AND category=$%d`, argIdx)
		args = append(args, category)
		argIdx++
	}

	query += ` ORDER BY timestamp DESC`

	var records []EntityCostRecord
	err := r.db.SelectContext(ctx, &records, query, args...)
	return records, err
}

// GetCostBreakdown aggregates costs by dimension (category/tenant/environment/provider/namespace).
type CostBreakdown struct {
	Dimension    string  `json:"dimension"`
	DimensionVal string  `json:"dimension_value"`
	Cost         float64 `json:"cost"`
	Percentage   float64 `json:"percentage"`
	RecordCount  int     `json:"record_count"`
}

// GetCloudCostBreakdown returns cost breakdown by dimension for cloud costs.
func (r *CostRepository) GetCloudCostBreakdown(ctx context.Context, tenantID, dimension string, periodStart, periodEnd time.Time) ([]CostBreakdown, error) {
	var column string
	switch dimension {
	case "category":
		column = "resource_type"
	case "provider":
		column = "provider"
	case "environment":
		column = "region"
	default:
		column = "resource_type"
	}

	query := fmt.Sprintf(`SELECT %s, COALESCE(SUM(cost_cents),0) as cost_cents, COUNT(*) as cnt FROM cloud_costs WHERE tenant_id=$1 AND period_start>=$2 AND period_end<=$3 GROUP BY %s ORDER BY cost_cents DESC`, column, column)
	rows, err := r.db.QueryContext(ctx, query, tenantID, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []CostBreakdown
	var total float64
	for rows.Next() {
		var row CostBreakdown
		var cost float64
		var cnt int
		if err := rows.Scan(&row.DimensionVal, &cost, &cnt); err != nil {
			return nil, err
		}
		row.Dimension = dimension
		row.Cost = cost
		row.RecordCount = cnt
		total += cost
		results = append(results, row)
	}

	for i := range results {
		if total > 0 {
			results[i].Percentage = results[i].Cost / total * 100
		}
	}

	return results, rows.Err()
}

// ==================== Cost Reports ====================

// FinOpsReport represents a generated cost report.
type FinOpsReport struct {
	ID         string             `db:"id" json:"id"`
	TenantID   string             `db:"tenant_id" json:"tenant_id"`
	Period     string             `db:"period" json:"period"`
	TotalCost  float64            `db:"total_cost" json:"total_cost"`
	Breakdown  sql.NullString     `db:"breakdown" json:"breakdown"`
	CreatedAt  time.Time          `db:"created_at" json:"created_at"`
}

// CreateReport inserts a cost report.
func (r *CostRepository) CreateReport(ctx context.Context, tenantID, period string, totalCost float64, breakdown map[string]float64) (*FinOpsReport, error) {
	bj, _ := json.Marshal(breakdown)
	query := `INSERT INTO finops_reports (id, tenant_id, period, total_cost, breakdown) VALUES ($1,$2,$3,$4,$5) RETURNING *`
	var rep FinOpsReport
	err := r.db.QueryRowContext(ctx, query, uuid.New().String(), tenantID, period, totalCost, string(bj)).Scan(
		&rep.ID, &rep.TenantID, &rep.Period, &rep.TotalCost, &rep.Breakdown, &rep.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &rep, nil
}

// GetReports retrieves reports for a tenant.
func (r *CostRepository) GetReports(ctx context.Context, tenantID string, limit int) ([]FinOpsReport, error) {
	var reports []FinOpsReport
	query := `SELECT * FROM finops_reports WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2`
	err := r.db.SelectContext(ctx, &reports, query, tenantID, limit)
	return reports, err
}

// ==================== ROI Analysis ====================

// ROIAnalysisRecord models an ROI analysis.
type ROIAnalysisRecord struct {
	ID             string             `db:"id" json:"id"`
	InvestmentType string             `db:"investment_type" json:"investment_type"`
	Name           string             `db:"name" json:"name"`
	Cost           float64            `db:"cost" json:"cost"`
	Savings        float64            `db:"savings" json:"savings"`
	Period         string             `db:"period" json:"period"`
	ROIPercentage  float64            `db:"roi_percentage" json:"roi_percentage"`
	PaybackMonths  sql.NullFloat64    `db:"payback_months" json:"payback_months"`
	Description    sql.NullString     `db:"description" json:"description"`
	Details        sql.NullString     `db:"details" json:"details"`
	AnalyzedAt     time.Time          `db:"analyzed_at" json:"analyzed_at"`
}

// CreateROIAnalysis inserts an ROI analysis.
func (r *CostRepository) CreateROIAnalysis(ctx context.Context, req models.CreateROIRequest) (*ROIAnalysisRecord, error) {
	query := `INSERT INTO finops_roi_analyses (id, investment_type, name, cost, savings, period, roi_percentage, payback_months, description, details)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`
	var roi ROIAnalysisRecord
	err := r.db.QueryRowContext(ctx, query,
		uuid.New().String(), req.InvestmentType, req.Name, req.Cost, req.Savings, req.Period, req.ROIPercentage, req.PaybackMonths, req.Description, req.Details,
	).Scan(&roi.ID, &roi.InvestmentType, &roi.Name, &roi.Cost, &roi.Savings, &roi.Period, &roi.ROIPercentage, &roi.PaybackMonths, &roi.Description, &roi.Details, &roi.AnalyzedAt)
	if err != nil {
		return nil, err
	}
	return &roi, nil
}

// GetROIHistory retrieves ROI analyses with optional filters.
func (r *CostRepository) GetROIHistory(ctx context.Context, investmentType string, minROI float64) ([]ROIAnalysisRecord, error) {
	query := `SELECT * FROM finops_roi_analyses WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if investmentType != "" {
		query += fmt.Sprintf(` AND investment_type=$%d`, argIdx)
		args = append(args, investmentType)
		argIdx++
	}
	if minROI > 0 {
		query += fmt.Sprintf(` AND roi_percentage>=$%d`, argIdx)
		args = append(args, minROI)
		argIdx++
	}

	query += ` ORDER BY analyzed_at DESC`

	var records []ROIAnalysisRecord
	err := r.db.SelectContext(ctx, &records, query, args...)
	return records, err
}

// ==================== Cost Comparisons ====================

// CostComparisonRecord models a cost comparison.
type CostComparisonRecord struct {
	ID             string          `db:"id" json:"id"`
	Description    string          `db:"description" json:"description"`
	BeforeCost     float64         `db:"before_cost" json:"before_cost"`
	AfterCost      float64         `db:"after_cost" json:"after_cost"`
	Savings        float64         `db:"savings" json:"savings"`
	SavingsPercent float64         `db:"savings_percent" json:"savings_percent"`
	Period         string          `db:"period" json:"period"`
}

// CreateCostComparison inserts a cost comparison.
func (r *CostRepository) CreateCostComparison(ctx context.Context, req models.CreateCostComparisonRequest) (*CostComparisonRecord, error) {
	query := `INSERT INTO finops_cost_comparisons (id, description, before_cost, after_cost, savings, savings_percent, period)
		VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`
	var comp CostComparisonRecord
	err := r.db.QueryRowContext(ctx, query,
		uuid.New().String(), req.Description, req.BeforeCost, req.AfterCost, req.Savings, req.SavingsPercent, req.Period,
	).Scan(&comp.ID, &comp.Description, &comp.BeforeCost, &comp.AfterCost, &comp.Savings, &comp.SavingsPercent, &comp.Period)
	if err != nil {
		return nil, err
	}
	return &comp, nil
}

// GetCostComparisons retrieves cost comparisons.
func (r *CostRepository) GetCostComparisons(ctx context.Context) ([]CostComparisonRecord, error) {
	var comps []CostComparisonRecord
	err := r.db.SelectContext(ctx, &comps, `SELECT * FROM finops_cost_comparisons ORDER BY id DESC`)
	return comps, err
}

// GetROISummary computes ROI summary statistics.
type ROISummary struct {
	TotalAnalyses       int     `json:"total_analyses"`
	AverageROI          float64 `json:"average_roi"`
	AveragePaybackMonths float64 `json:"average_payback_months"`
	TotalComparisons    int     `json:"total_comparisons"`
	TotalSavings        float64 `json:"total_savings"`
}

func (r *CostRepository) GetROISummary(ctx context.Context) (*ROISummary, error) {
	summary := &ROISummary{}

	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM finops_roi_analyses`).Scan(&summary.TotalAnalyses)
	if err != nil {
		return nil, err
	}

	err = r.db.QueryRowContext(ctx, `SELECT COALESCE(AVG(roi_percentage),0) FROM finops_roi_analyses`).Scan(&summary.AverageROI)
	if err != nil {
		return nil, err
	}

	err = r.db.QueryRowContext(ctx, `SELECT COALESCE(AVG(payback_months),0) FROM finops_roi_analyses WHERE payback_months IS NOT NULL`).Scan(&summary.AveragePaybackMonths)
	if err != nil {
		return nil, err
	}

	err = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM finops_cost_comparisons`).Scan(&summary.TotalComparisons)
	if err != nil {
		return nil, err
	}

	err = r.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(savings),0) FROM finops_cost_comparisons`).Scan(&summary.TotalSavings)
	if err != nil {
		return nil, err
	}

	return summary, nil
}

// ==================== Chargeback Report ====================

// ChargebackEntity represents one entity in a chargeback report.
type ChargebackEntity struct {
	EntityType  string             `json:"entity_type"`
	EntityID    string             `json:"entity_id"`
	Cost        float64            `json:"cost"`
	Percentage  float64            `json:"percentage"`
	Breakdown   map[string]float64 `json:"breakdown"`
}

// ChargebackReport represents a chargeback report.
type ChargebackReport struct {
	ID          string             `json:"id"`
	GeneratedAt time.Time          `json:"generated_at"`
	Period      string             `json:"period"`
	TotalCost   float64            `json:"total_cost"`
	Entities    []ChargebackEntity `json:"entities"`
	Currency    string             `json:"currency"`
}

// GetChargebackReport generates a chargeback report for a tenant within a period.
func (r *CostRepository) GetChargebackReport(ctx context.Context, tenantID string, periodStart, periodEnd time.Time) (*ChargebackReport, error) {
	// Aggregate all cost records by entity
	rows, err := r.db.QueryContext(ctx, `SELECT entity_type, entity_id, category, COALESCE(SUM(amount),0) as cost
		FROM finops_cost_records
		WHERE timestamp>=$1 AND timestamp<=$2
		GROUP BY entity_type, entity_id, category
		ORDER BY cost DESC`, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entityMap := make(map[string]*ChargebackEntity)
	var totalCost float64

	for rows.Next() {
		var entityType, entityId, category string
		var cost float64
		if err := rows.Scan(&entityType, &entityId, &category, &cost); err != nil {
			return nil, err
		}
		key := entityType + ":" + entityId
		ce, ok := entityMap[key]
		if !ok {
			ce = &ChargebackEntity{
				EntityType: entityType,
				EntityID:   entityId,
				Breakdown:  make(map[string]float64),
			}
			entityMap[key] = ce
		}
		ce.Cost += cost
		ce.Breakdown[category] += cost
		totalCost += cost
	}

	var entities []ChargebackEntity
	for _, ce := range entityMap {
		if totalCost > 0 {
			ce.Percentage = ce.Cost / totalCost * 100
		}
		entities = append(entities, *ce)
	}

	return &ChargebackReport{
		ID:          uuid.New().String(),
		GeneratedAt: time.Now(),
		TotalCost:   totalCost,
		Entities:    entities,
		Currency:    "USD",
	}, nil
}

// ==================== Legacy Budget Alerts (finops_budget_alerts) ====================

// CreateLegacyBudgetAlert inserts a legacy budget alert.
func (r *CostRepository) CreateLegacyBudgetAlert(ctx context.Context, a *models.LegacyBudgetAlert) error {
	query := `INSERT INTO finops_budget_alerts (id, tenant_id, environment, budget_amount, threshold_percent, currency, period)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`
	_, err := r.db.ExecContext(ctx, query, a.ID, a.TenantID, a.Environment, a.BudgetAmount, a.ThresholdPercent, a.Currency, a.Period)
	return err
}

// GetLegacyBudgetAlerts retrieves legacy budget alerts.
func (r *CostRepository) GetLegacyBudgetAlerts(ctx context.Context, tenantID, environment string) ([]models.LegacyBudgetAlert, error) {
	query := `SELECT * FROM finops_budget_alerts WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if tenantID != "" {
		query += fmt.Sprintf(` AND tenant_id=$%d`, argIdx)
		args = append(args, tenantID)
		argIdx++
	}
	if environment != "" {
		query += fmt.Sprintf(` AND environment=$%d`, argIdx)
		args = append(args, environment)
		argIdx++
	}

	query += ` ORDER BY created_at DESC`

	var alerts []models.LegacyBudgetAlert
	err := r.db.SelectContext(ctx, &alerts, query, args...)
	return alerts, err
}

// DeleteLegacyBudgetAlert deletes a legacy budget alert.
func (r *CostRepository) DeleteLegacyBudgetAlert(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM finops_budget_alerts WHERE id=$1`, id)
	return err
}

// UpdateLegacyBudgetAlertSpend updates current spend for a legacy budget alert.
func (r *CostRepository) UpdateLegacyBudgetAlertSpend(ctx context.Context, id string, spend float64) error {
	_, err := r.db.ExecContext(ctx, `UPDATE finops_budget_alerts SET current_spend=$1, triggered=CASE WHEN $1>=$2 THEN TRUE ELSE triggered END WHERE id=$3`,
		spend, 0, id)
	return err
}
