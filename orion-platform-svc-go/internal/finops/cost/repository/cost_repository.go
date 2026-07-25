package repository

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/finops/cost/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrNotFound = errors.New("record not found")
)

// CostRepository provides data access for cost records, budgets, and anomaly alerts.
type CostRepository struct {
	db *sqlx.DB
}

// NewCostRepository creates a new repository instance.
func NewCostRepository(db *sqlx.DB) *CostRepository {
	return &CostRepository{db: db}
}

// ==================== Cost Records ====================

// CreateCostRecord inserts a new cost record and returns it with generated fields.
func (r *CostRepository) CreateCostRecord(ctx context.Context, record *models.CostRecord) error {
	record.ID = uuid.New().String()
	record.Currency = normalizeCurrency(record.Currency)
	record.Category = normalizeCategory(record.Category)
	record.CreatedAt = time.Now()

	query := `INSERT INTO cost_records (id, tenant_id, date, service, resource_id, region, cost, currency, category, tags)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`
	_, err := r.db.ExecContext(ctx, query,
		record.ID, record.TenantID, record.Date, record.Service,
		record.ResourceID, record.Region, record.Cost, record.Currency,
		record.Category, record.Tags)
	return err
}

// FindCostRecords retrieves cost records with optional filters and pagination.
func (r *CostRepository) FindCostRecords(ctx context.Context, tenantID string, filter *ListFilter, offset, limit int) ([]models.CostRecord, error) {
	query := `SELECT * FROM cost_records WHERE tenant_id=$1 AND 1=1`
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.StartDate != "" {
			args = append(args, filter.StartDate)
			query += fmt.Sprintf(` AND date >= $%d`, argIdx)
			argIdx++
		}
		if filter.EndDate != "" {
			args = append(args, filter.EndDate)
			query += fmt.Sprintf(` AND date <= $%d`, argIdx)
			argIdx++
		}
		if filter.Service != "" {
			args = append(args, filter.Service)
			query += fmt.Sprintf(` AND service = $%d`, argIdx)
			argIdx++
		}
		if filter.Region != "" {
			args = append(args, filter.Region)
			query += fmt.Sprintf(` AND region = $%d`, argIdx)
			argIdx++
		}
		if filter.ResourceID != "" {
			args = append(args, filter.ResourceID)
			query += fmt.Sprintf(` AND resource_id = $%d`, argIdx)
			argIdx++
		}
	}

	query += fmt.Sprintf(` ORDER BY date DESC OFFSET $%d LIMIT $%d`, argIdx, argIdx+1)
	args = append(args, offset, limit)

	var records []models.CostRecord
	err := r.db.SelectContext(ctx, &records, query, args...)
	return records, err
}

// GetTotalCost returns the sum of costs for a tenant in a date range.
func (r *CostRepository) GetTotalCost(ctx context.Context, tenantID, startDate, endDate string) (float64, error) {
	var total float64
	query := `SELECT COALESCE(SUM(cost),0) FROM cost_records WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	argIdx := 2

	if startDate != "" {
		args = append(args, startDate)
		query += fmt.Sprintf(` AND date >= $%d`, argIdx)
		argIdx++
	}
	if endDate != "" {
		args = append(args, endDate)
		query += fmt.Sprintf(` AND date <= $%d`, argIdx)
		argIdx++
	}

	err := r.db.QueryRowContext(ctx, query, args...).Scan(&total)
	return total, err
}

// GetCostByService aggregates costs grouped by service.
func (r *CostRepository) GetCostByService(ctx context.Context, tenantID, startDate, endDate string) ([]models.CostAggregation, error) {
	query := `SELECT service, COALESCE(SUM(cost),0) as total_cost, COUNT(*) as count
		FROM cost_records WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	argIdx := 2

	if startDate != "" {
		args = append(args, startDate)
		query += fmt.Sprintf(` AND date >= $%d`, argIdx)
		argIdx++
	}
	if endDate != "" {
		args = append(args, endDate)
		query += fmt.Sprintf(` AND date <= $%d`, argIdx)
		argIdx++
	}

	query += ` GROUP BY service ORDER BY total_cost DESC`

	var aggregations []models.CostAggregation
	err := r.db.SelectContext(ctx, &aggregations, query, args...)
	return aggregations, err
}

// GetCostByResource aggregates costs grouped by resource_id.
func (r *CostRepository) GetCostByResource(ctx context.Context, tenantID, startDate, endDate string) ([]models.CostAggregation, error) {
	query := `SELECT resource_id as service, COALESCE(SUM(cost),0) as total_cost, COUNT(*) as count
		FROM cost_records WHERE tenant_id=$1 AND resource_id IS NOT NULL`
	args := []interface{}{tenantID}
	argIdx := 2

	if startDate != "" {
		args = append(args, startDate)
		query += fmt.Sprintf(` AND date >= $%d`, argIdx)
		argIdx++
	}
	if endDate != "" {
		args = append(args, endDate)
		query += fmt.Sprintf(` AND date <= $%d`, argIdx)
		argIdx++
	}

	query += ` GROUP BY resource_id ORDER BY total_cost DESC`

	var aggregations []models.CostAggregation
	err := r.db.SelectContext(ctx, &aggregations, query, args...)
	return aggregations, err
}

// GetCostSummary aggregates costs across service, region, and category.
func (r *CostRepository) GetCostSummary(ctx context.Context, tenantID, startDate, endDate string) (*models.CostSummary, error) {
	summary := &models.CostSummary{
		Currency:   "USD",
		ByService:  make(map[string]float64),
		ByResource: make(map[string]float64),
		ByRegion:   make(map[string]float64),
		ByCategory: make(map[string]float64),
	}

	whereClause, args := buildDateFilter(tenantID, startDate, endDate)

	// Total
	err := r.db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COALESCE(SUM(cost),0) FROM cost_records WHERE %s`, whereClause), args...).Scan(&summary.TotalCost)
	if err != nil {
		return nil, err
	}

	// Count
	err = r.db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM cost_records WHERE %s`, whereClause), args...).Scan(&summary.RecordCount)
	if err != nil {
		return nil, err
	}

	// By service
	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(`SELECT service, SUM(cost) FROM cost_records WHERE %s GROUP BY service`, whereClause), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var service string
		var total float64
		if err := rows.Scan(&service, &total); err != nil {
			return nil, err
		}
		summary.ByService[service] = total
	}

	// By region
	rows, err = r.db.QueryContext(ctx, fmt.Sprintf(`SELECT region, SUM(cost) FROM cost_records WHERE %s AND region IS NOT NULL GROUP BY region`, whereClause), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var region string
		var total float64
		if err := rows.Scan(&region, &total); err != nil {
			return nil, err
		}
		summary.ByRegion[region] = total
	}

	// By category
	rows, err = r.db.QueryContext(ctx, fmt.Sprintf(`SELECT category, SUM(cost) FROM cost_records WHERE %s GROUP BY category`, whereClause), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var category string
		var total float64
		if err := rows.Scan(&category, &total); err != nil {
			return nil, err
		}
		summary.ByCategory[category] = total
	}

	summary.PeriodStart = startDate
	summary.PeriodEnd = endDate
	return summary, nil
}

// GetDailyCostTrend returns daily aggregated costs for trend analysis.
func (r *CostRepository) GetDailyCostTrend(ctx context.Context, tenantID, startDate, endDate string) ([]models.CostTrendPoint, error) {
	whereClause, args := buildDateFilter(tenantID, startDate, endDate)
	query := fmt.Sprintf(`
		SELECT DATE(date) as date, COALESCE(SUM(cost),0) as cost
		FROM cost_records WHERE %s
		GROUP BY DATE(date) ORDER BY DATE(date)`, whereClause)

	var points []models.CostTrendPoint
	err := r.db.SelectContext(ctx, &points, query, args...)
	return points, err
}

// ==================== Budgets ====================

// CreateBudget inserts a new budget.
func (r *CostRepository) CreateBudget(ctx context.Context, budget *models.Budget) error {
	budget.ID = uuid.New().String()
	budget.CreatedAt = time.Now()
	budget.UpdatedAt = time.Now()
	if budget.Status == "" {
		budget.Status = string(models.BudgetStatusActive)
	}
	if budget.AlertThreshold <= 0 {
		budget.AlertThreshold = 80.0
	}

	query := `INSERT INTO budgets (id, tenant_id, name, amount, period, alert_threshold, current_spend, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`
	_, err := r.db.ExecContext(ctx, query,
		budget.ID, budget.TenantID, budget.Name, budget.Amount,
		budget.Period, budget.AlertThreshold, budget.CurrentSpend, budget.Status)
	return err
}

// GetBudget retrieves a budget by ID.
func (r *CostRepository) GetBudget(ctx context.Context, tenantID, id string) (*models.Budget, error) {
	var budget models.Budget
	err := r.db.GetContext(ctx, &budget, `SELECT * FROM budgets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &budget, nil
}

// ListBudgets retrieves budgets for a tenant.
func (r *CostRepository) ListBudgets(ctx context.Context, tenantID string, offset, limit int) ([]models.Budget, error) {
	var budgets []models.Budget
	query := `SELECT * FROM budgets WHERE tenant_id=$1 AND status != $2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`
	err := r.db.SelectContext(ctx, &budgets, query, tenantID, string(models.BudgetStatusDeleted), offset, limit)
	return budgets, err
}

// UpdateBudget updates an existing budget.
func (r *CostRepository) UpdateBudget(ctx context.Context, budget *models.Budget) error {
	budget.UpdatedAt = time.Now()
	query := `UPDATE budgets SET name=$1, amount=$2, period=$3, alert_threshold=$4, updated_at=$5 WHERE id=$6 AND tenant_id=$7`
	_, err := r.db.ExecContext(ctx, query,
		budget.Name, budget.Amount, budget.Period, budget.AlertThreshold,
		budget.UpdatedAt, budget.ID, budget.TenantID)
	return err
}

// UpdateBudgetSpend updates the current spend of a budget.
func (r *CostRepository) UpdateBudgetSpend(ctx context.Context, id string, spend float64) (*models.Budget, error) {
	var budget models.Budget
	err := r.db.GetContext(ctx, &budget, `SELECT * FROM budgets WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}

	budget.CurrentSpend = spend
	budget.UpdatedAt = time.Now()
	if spend >= budget.Amount {
		budget.Status = string(models.BudgetStatusExhausted)
	}

	_, err = r.db.ExecContext(ctx, `UPDATE budgets SET current_spend=$1, status=$2, updated_at=$3 WHERE id=$4`,
		budget.CurrentSpend, budget.Status, budget.UpdatedAt, budget.ID)
	if err != nil {
		return nil, err
	}
	return &budget, nil
}

// GetBudgetAlerts returns budgets that have breached their alert threshold.
func (r *CostRepository) GetBudgetAlerts(ctx context.Context, tenantID string) ([]models.Budget, error) {
	var budgets []models.Budget
	query := `SELECT * FROM budgets WHERE tenant_id=$1 AND status != $2 AND current_spend >= (amount * alert_threshold / 100) ORDER BY current_spend DESC`
	err := r.db.SelectContext(ctx, &budgets, query, tenantID, string(models.BudgetStatusDeleted))
	return budgets, err
}

// ==================== Anomaly Alerts ====================

// CreateAnomalyAlert stores a detected anomaly in the database.
func (r *CostRepository) CreateAnomalyAlert(ctx context.Context, alert *models.AnomalyAlert) error {
	alert.ID = uuid.New().String()
	alert.DetectedAt = time.Now()

	query := `INSERT INTO cost_anomalies (id, tenant_id, type, severity, value, expected_value, deviation, detected_at, time_window_start, time_window_end, description, metadata)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`
	_, err := r.db.ExecContext(ctx, query,
		alert.ID, alert.TenantID, alert.Type, alert.Severity,
		alert.Value, alert.ExpectedValue, alert.Deviation, alert.DetectedAt,
		alert.TimeWindowStart, alert.TimeWindowEnd, alert.Description, alert.Metadata)
	return err
}

// GetAnomalies retrieves anomalies for a tenant.
func (r *CostRepository) GetAnomalies(ctx context.Context, tenantID, severity string, offset, limit int) ([]models.AnomalyAlert, error) {
	query := `SELECT * FROM cost_anomalies WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	argIdx := 2

	if severity != "" {
		args = append(args, severity)
		query += fmt.Sprintf(` AND severity=$%d`, argIdx)
		argIdx++
	}

	query += fmt.Sprintf(` ORDER BY detected_at DESC OFFSET $%d LIMIT $%d`, argIdx, argIdx+1)
	args = append(args, offset, limit)

	var alerts []models.AnomalyAlert
	err := r.db.SelectContext(ctx, &alerts, query, args...)
	return alerts, err
}

// GetOptimizations retrieves cost optimization recommendations for a tenant.
// This is a minimal implementation that returns empty results.
func (r *CostRepository) GetOptimizations(ctx context.Context, tenantID, category, status string, offset, limit int) ([]models.OptimizationRecommendation, error) {
	return nil, nil
}

// GetRecentAnomalies returns the most recent anomalies for a tenant.
func (r *CostRepository) GetRecentAnomalies(ctx context.Context, tenantID string, limit int) ([]models.AnomalyAlert, error) {
	var alerts []models.AnomalyAlert
	err := r.db.SelectContext(ctx, `SELECT * FROM cost_anomalies WHERE tenant_id=$1 ORDER BY detected_at DESC LIMIT $2`, tenantID, limit)
	return alerts, err
}

// DeleteCostRecord removes a cost record by ID.
func (r *CostRepository) DeleteCostRecord(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM cost_records WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// CountCostRecords returns the total number of cost records for a tenant.
func (r *CostRepository) CountCostRecords(ctx context.Context, tenantID string) (int64, error) {
	var count int64
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM cost_records WHERE tenant_id=$1`, tenantID)
	return count, err
}

// GetMonthlyCost returns the total cost for a given month.
func (r *CostRepository) GetMonthlyCost(ctx context.Context, tenantID, mode string) (float64, error) {
	var total float64
	if mode == "previous" {
		err := r.db.QueryRowContext(ctx,
			`SELECT COALESCE(SUM(cost),0) FROM cost_records WHERE tenant_id=$1 AND date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND date < DATE_TRUNC('month', CURRENT_DATE)`, tenantID).Scan(&total)
		return total, err
	}
	err := r.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(cost),0) FROM cost_records WHERE tenant_id=$1 AND date >= DATE_TRUNC('month', CURRENT_DATE)`, tenantID).Scan(&total)
	return total, err
}

// GetCostByServiceName returns the total cost for a specific service.
func (r *CostRepository) GetCostByServiceName(ctx context.Context, tenantID, serviceName, period string) (float64, error) {
	var total float64
	var err error
	switch period {
	case "monthly":
		err = r.db.QueryRowContext(ctx,
			`SELECT COALESCE(SUM(cost),0) FROM cost_records WHERE tenant_id=$1 AND service=$2 AND date >= DATE_TRUNC('month', CURRENT_DATE)`, tenantID, serviceName).Scan(&total)
	case "previous":
		err = r.db.QueryRowContext(ctx,
			`SELECT COALESCE(SUM(cost),0) FROM cost_records WHERE tenant_id=$1 AND service=$2 AND date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND date < DATE_TRUNC('month', CURRENT_DATE)`, tenantID, serviceName).Scan(&total)
	default:
		err = r.db.QueryRowContext(ctx,
			`SELECT COALESCE(SUM(cost),0) FROM cost_records WHERE tenant_id=$1 AND service=$2`, tenantID, serviceName).Scan(&total)
	}
	return total, err
}

// GetServiceCostTrend returns daily aggregated costs for a specific service.
func (r *CostRepository) GetServiceCostTrend(ctx context.Context, tenantID, serviceName, category string) ([]models.CostTrendPoint, error) {
	query := `SELECT DATE(date) as date, COALESCE(SUM(cost),0) as cost
		FROM cost_records WHERE tenant_id=$1 AND service=$2`
	args := []interface{}{tenantID, serviceName}
	argIdx := 3

	if category != "" {
		args = append(args, category)
		query += fmt.Sprintf(` AND category=$%d`, argIdx)
		argIdx++
	}
	query += ` GROUP BY DATE(date) ORDER BY DATE(date)`

	var points []models.CostTrendPoint
	err := r.db.SelectContext(ctx, &points, query, args...)
	return points, err
}

// ==================== Query Filters ====================

// ListFilter holds optional query filters.
type ListFilter struct {
	StartDate  string
	EndDate    string
	Service    string
	ResourceID string
	Region     string
}

// ==================== Helpers ====================

func buildDateFilter(tenantID, startDate, endDate string) (string, []interface{}) {
	where := `tenant_id=$1`
	args := []interface{}{tenantID}
	argIdx := 2

	if startDate != "" {
		args = append(args, startDate)
		where += fmt.Sprintf(` AND date >= $%d`, argIdx)
		argIdx++
	}
	if endDate != "" {
		args = append(args, endDate)
		where += fmt.Sprintf(` AND date <= $%d`, argIdx)
		argIdx++
	}
	return where, args
}

func normalizeCurrency(currency string) string {
	if currency == "" {
		return "USD"
	}
	return currency
}

func normalizeCategory(category string) string {
	if category == "" {
		return "other"
	}
	return category
}

// Ensure JSONB implements sql.Scanner for sqlx.
var _ driver.Valuer = models.JSONB(nil)
var _ sql.Scanner = (*models.JSONB)(nil)
