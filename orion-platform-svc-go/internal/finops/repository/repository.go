package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/finops/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

// validEntityType checks if the entity type is allowed.
func validEntityType(t models.CostEntityType) bool {
	switch t {
	case models.CostEntityTypeProject, models.CostEntityTypeTenant, models.CostEntityTypeTeam:
		return true
	}
	return false
}

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Budget Guards ---

func (r *Repository) CreateBudgetGuard(ctx context.Context, guard *models.BudgetGuard) error {
	guard.ID = uuid.New().String()
	now := time.Now().UTC()
	guard.CreatedAt = now
	guard.UpdatedAt = now
	if guard.Currency == "" {
		guard.Currency = "USD"
	}
	if guard.Action == "" {
		guard.Action = "warn"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO finops_budget_guards (id, tenant_id, name, description, budget_amount, threshold_pct, currency, action, scope, enabled, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :description, :budgetAmount, :thresholdPct, :currency, :action, :scope, :enabled, :createdAt, :updatedAt)`,
		guard)
	return err
}

func (r *Repository) GetBudgetGuard(ctx context.Context, id string, tenantID string) (*models.BudgetGuard, error) {
	var guard models.BudgetGuard
	err := r.db.GetContext(ctx, &guard,
		`SELECT * FROM finops_budget_guards WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &guard, nil
}

func (r *Repository) ListBudgetGuards(ctx context.Context, tenantID string) ([]models.BudgetGuard, error) {
	var guards []models.BudgetGuard
	err := r.db.SelectContext(ctx, &guards,
		`SELECT * FROM finops_budget_guards WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return guards, err
}

func (r *Repository) DeleteBudgetGuard(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM finops_budget_guards WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Budget (full CRUD) ---

func (r *Repository) CreateBudget(ctx context.Context, tenantID string, budget *models.Budget) error {
	budget.ID = uuid.New().String()
	budget.TenantID = tenantID
	now := time.Now().UTC()
	budget.CreatedAt = now
	budget.UpdatedAt = now
	if budget.Currency == "" {
		budget.Currency = "USD"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO finops_budgets (id, tenant_id, entity_type, entity_id, amount, period, currency, alerts, environment, description, created_at, updated_at)
		 VALUES (:id, :tenantId, :entityType, :entityId, :amount, :period, :currency, :alerts, :environment, :description, :createdAt, :updatedAt)`,
		budget)
	return err
}

func (r *Repository) GetBudget(ctx context.Context, id string, tenantID string) (*models.Budget, error) {
	var b models.Budget
	err := r.db.GetContext(ctx, &b,
		`SELECT * FROM finops_budgets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *Repository) ListBudgets(ctx context.Context, tenantID string, entityType *models.CostEntityType, entityID *string) ([]models.Budget, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if entityType != nil && *entityType != "" {
		where += fmt.Sprintf(" AND entity_type = $%d", argIdx)
		args = append(args, *entityType)
		argIdx++
	}
	if entityID != nil && *entityID != "" {
		where += fmt.Sprintf(" AND entity_id = $%d", argIdx)
		args = append(args, *entityID)
		argIdx++
	}
	var budgets []models.Budget
	err := r.db.SelectContext(ctx, &budgets,
		fmt.Sprintf(`SELECT * FROM finops_budgets %s ORDER BY created_at DESC`, where), args...)
	return budgets, err
}

func (r *Repository) UpdateBudget(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Budget, error) {
	set, args, err := buildUpdateSetWithPrefix(updates)
	if err != nil {
		return nil, err
	}
	args = append([]interface{}{id, tenantID}, args...)
	queryStr := fmt.Sprintf(`UPDATE finops_budgets SET %s, updated_at = $%d WHERE id=$1 AND tenant_id=$2 RETURNING *`, set, len(updates)+2)
	var b models.Budget
	err = r.db.GetContext(ctx, &b, queryStr, args...)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *Repository) DeleteBudget(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM finops_budgets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Anomalies ---

func (r *Repository) ListAnomalies(ctx context.Context, tenantID string, severity *string, timeWindow *models.TimeWindow) ([]models.Anomaly, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if severity != nil && *severity != "" {
		where += fmt.Sprintf(" AND severity = $%d", argIdx)
		args = append(args, *severity)
		argIdx++
	}
	if timeWindow != nil {
		where += fmt.Sprintf(" AND detected_at BETWEEN $%d AND $%d", argIdx, argIdx+1)
		args = append(args, timeWindow.Start, timeWindow.End)
		argIdx += 2
	}
	var anomalies []models.Anomaly
	err := r.db.SelectContext(ctx, &anomalies,
		fmt.Sprintf(`SELECT * FROM finops_anomalies %s ORDER BY detected_at DESC`, where), args...)
	return anomalies, err
}

func (r *Repository) CreateAnomaly(ctx context.Context, anomaly *models.Anomaly) error {
	anomaly.ID = uuid.New().String()
	now := time.Now().UTC()
	anomaly.DetectedAt = now
	anomaly.CreatedAt = now
	if anomaly.Metadata == "" {
		anomaly.Metadata = "{}"
	}
	if anomaly.Metadata == "" {
		anomaly.Metadata = "{}"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO finops_anomalies (id, tenant_id, type, severity, value, expected_value, deviation, description, metadata, time_window_start, time_window_end, detected_at, created_at)
		 VALUES (:id, :tenantId, :type, :severity, :value, :expectedValue, :deviation, :description, :metadata, :timeWindowStart, :timeWindowEnd, :detectedAt, :createdAt)`,
		anomaly)
	return err
}

// --- Cost Items ---

func (r *Repository) ListCostItems(ctx context.Context, tenantID string, service *string) ([]models.CostItem, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if service != nil && *service != "" {
		where += fmt.Sprintf(" AND service = $%d", argIdx)
		args = append(args, *service)
	}
	var items []models.CostItem
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT * FROM finops_cost_items %s ORDER BY created_at DESC`, where), args...)
	return items, err
}

func (r *Repository) CreateCostItem(ctx context.Context, item *models.CostItem) error {
	item.ID = uuid.New().String()
	item.CreatedAt = time.Now().UTC()
	if item.Currency == "" {
		item.Currency = "USD"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO finops_cost_items (id, tenant_id, service, cost, currency, period, created_at)
		 VALUES (:id, :tenantId, :service, :cost, :currency, :period, :createdAt)`,
		item)
	return err
}

func (r *Repository) GetCostByService(ctx context.Context, tenantID string, service string) (*models.CostItem, error) {
	var item models.CostItem
	err := r.db.GetContext(ctx, &item,
		`SELECT * FROM finops_cost_items WHERE tenant_id=$1 AND service=$2 ORDER BY created_at DESC LIMIT 1`, tenantID, service)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

// --- Cost Trend ---

func (r *Repository) GetCostTrend(ctx context.Context, tenantID string, days int) ([]models.TrendPoint, error) {
	var points []models.TrendPoint
	query := fmt.Sprintf(`
		SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS period, SUM(cost) AS cost
		FROM finops_cost_items
		WHERE tenant_id=$1 AND created_at >= NOW() - INTERVAL '%d days'
		GROUP BY DATE_TRUNC('day', created_at)
		ORDER BY period
	`, days)
	err := r.db.SelectContext(ctx, &points, query, tenantID)
	return points, err
}

// --- Budget Guard count for overview ---

func (r *Repository) CountBudgetGuards(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM finops_budget_guards WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ============================================================================
// Usage Metering (billing)
// ============================================================================

func (r *Repository) CreateUsageRecord(ctx context.Context, tenantID string, rec *models.UsageRecord) error {
	rec.ID = uuid.New().String()
	rec.TenantID = tenantID
	rec.CreatedAt = time.Now().UTC()
	if rec.Metadata == "" {
		rec.Metadata = "{}"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO finops_usage_records (id, tenant_id, service, metric, quantity, unit_price, total_cost, period_start, period_end, metadata, created_at)
		 VALUES (:id, :tenantId, :service, :metric, :quantity, :unitPrice, :totalCost, :periodStart, :periodEnd, :metadata, :createdAt)`,
		rec)
	return err
}

func (r *Repository) ListUsageRecords(ctx context.Context, tenantID string, service *string, periodStart, periodEnd *string) ([]models.UsageRecord, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if service != nil && *service != "" {
		where += fmt.Sprintf(" AND service = $%d", argIdx)
		args = append(args, *service)
		argIdx++
	}
	if periodStart != nil && *periodStart != "" {
		where += fmt.Sprintf(" AND period_start >= $%d", argIdx)
		args = append(args, *periodStart)
		argIdx++
	}
	if periodEnd != nil && *periodEnd != "" {
		where += fmt.Sprintf(" AND period_end <= $%d", argIdx)
		args = append(args, *periodEnd)
		argIdx++
	}
	var records []models.UsageRecord
	err := r.db.SelectContext(ctx, &records,
		fmt.Sprintf(`SELECT * FROM finops_usage_records %s ORDER BY created_at DESC`, where), args...)
	return records, err
}

func (r *Repository) GetUsageSummary(ctx context.Context, tenantID string, period string) (*models.UsageSummary, error) {
	var totalCost float64
	err := r.db.GetContext(ctx, &totalCost,
		`SELECT COALESCE(SUM(total_cost), 0) FROM finops_usage_records WHERE tenant_id=$1 AND period_start LIKE $2`, tenantID, period+"%")
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	byService := make(map[string]float64)
	rows, err := r.db.QueryContext(ctx,
		`SELECT service, SUM(total_cost) FROM finops_usage_records WHERE tenant_id=$1 AND period_start LIKE $2 GROUP BY service`, tenantID, period+"%")
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var svc string
			var cost float64
			if err := rows.Scan(&svc, &cost); err == nil {
				byService[svc] = cost
			}
		}
	}
	return &models.UsageSummary{
		TotalCost: totalCost,
		ByService: byService,
		Period:    period,
	}, nil
}

// ============================================================================
// Billing Records
// ============================================================================

func (r *Repository) CreateBillingRecord(ctx context.Context, rec *models.BillingRecord) error {
	rec.ID = uuid.New().String()
	now := time.Now().UTC()
	rec.CreatedAt = now
	rec.UpdatedAt = now
	if rec.Items == "" {
		// Items is JSON, should already be set by service
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO finops_billing_records (id, tenant_id, billing_period, status, total_amount, paid_amount, due_date, items, created_at, updated_at)
		 VALUES (:id, :tenantId, :billingPeriod, :status, :totalAmount, :paidAmount, :dueDate, :items, :createdAt, :updatedAt)`,
		rec)
	return err
}

func (r *Repository) GetBillingRecord(ctx context.Context, id string, tenantID string) (*models.BillingRecord, error) {
	var rec models.BillingRecord
	err := r.db.GetContext(ctx, &rec,
		`SELECT * FROM finops_billing_records WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *Repository) ListBillingRecords(ctx context.Context, tenantID string, status *string, period *string) ([]models.BillingRecord, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *status)
		argIdx++
	}
	if period != nil && *period != "" {
		where += fmt.Sprintf(" AND billing_period = $%d", argIdx)
		args = append(args, *period)
		argIdx++
	}
	var records []models.BillingRecord
	err := r.db.SelectContext(ctx, &records,
		fmt.Sprintf(`SELECT * FROM finops_billing_records %s ORDER BY created_at DESC`, where), args...)
	return records, err
}

func (r *Repository) UpdateBillingRecord(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.BillingRecord, error) {
	set, args, err := buildUpdateSetWithPrefix(updates)
	if err != nil {
		return nil, err
	}
	args = append([]interface{}{id, tenantID}, args...)
	// Use scan into a new BillingRecord via QueryRow
	billing := &models.BillingRecord{}
	query := fmt.Sprintf(`UPDATE finops_billing_records SET %s, updated_at = $%d WHERE id=$1 AND tenant_id=$2 RETURNING *`, set, len(updates)+2)
	err = r.db.GetContext(ctx, billing, query, args...)
	if err != nil {
		return nil, err
	}
	return billing, nil
}

func (r *Repository) GetBillingSummary(ctx context.Context, tenantID string) (*models.BillingSummary, error) {
	var totalBilling, paidAmount, pendingAmount, overdueAmount float64
	err := r.db.GetContext(ctx, &totalBilling,
		`SELECT COALESCE(SUM(total_amount), 0) FROM finops_billing_records WHERE tenant_id=$1`, tenantID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	err = r.db.GetContext(ctx, &paidAmount,
		`SELECT COALESCE(SUM(paid_amount), 0) FROM finops_billing_records WHERE tenant_id=$1 AND status='paid'`, tenantID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	err = r.db.GetContext(ctx, &pendingAmount,
		`SELECT COALESCE(SUM(total_amount - paid_amount), 0) FROM finops_billing_records WHERE tenant_id=$1 AND status='pending'`, tenantID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	err = r.db.GetContext(ctx, &overdueAmount,
		`SELECT COALESCE(SUM(total_amount - paid_amount), 0) FROM finops_billing_records WHERE tenant_id=$1 AND status='overdue'`, tenantID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	return &models.BillingSummary{
		TotalBilling:   totalBilling,
		PaidAmount:     paidAmount,
		PendingAmount:  pendingAmount,
		OverdueAmount:  overdueAmount,
	}, nil
}

// ============================================================================
// Cost Tracking (entity-level)
// ============================================================================

func (r *Repository) CreateCostRecord(ctx context.Context, tenantID string, rec *models.CostRecord) error {
	rec.ID = uuid.New().String()
	rec.TenantID = tenantID
	rec.CreatedAt = time.Now().UTC()
	if rec.Currency == "" {
		rec.Currency = "USD"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO finops_cost_records (id, tenant_id, entity_type, entity_id, amount, category, currency, environment, metadata, created_at)
		 VALUES (:id, :tenantId, :entityType, :entityId, :amount, :category, :currency, :environment, :metadata, :createdAt)`,
		rec)
	return err
}

func (r *Repository) GetCostByEntity(ctx context.Context, tenantID string, entityType models.CostEntityType, entityID string, period string) (*models.EntityCostSummary, error) {
	var totalCost float64
	var recordCount int
	err := r.db.GetContext(ctx, &totalCost,
		`SELECT COALESCE(SUM(amount), 0) FROM finops_cost_records WHERE tenant_id=$1 AND entity_type=$2 AND entity_id=$3`, tenantID, entityType, entityID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	err = r.db.GetContext(ctx, &recordCount,
		`SELECT COUNT(*) FROM finops_cost_records WHERE tenant_id=$1 AND entity_type=$2 AND entity_id=$3`, tenantID, entityType, entityID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	breakdown := make(map[string]float64)
	rows, err := r.db.QueryContext(ctx,
		`SELECT category, SUM(amount) FROM finops_cost_records WHERE tenant_id=$1 AND entity_type=$2 AND entity_id=$3 GROUP BY category`, tenantID, entityType, entityID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var cat string
			var amt float64
			if err := rows.Scan(&cat, &amt); err == nil {
				breakdown[cat] = round2(amt)
			}
		}
	}
	return &models.EntityCostSummary{
		EntityType:  entityType,
		EntityID:    entityID,
		TotalCost:   round2(totalCost),
		Breakdown:   breakdown,
		Period:      period,
		Currency:    "USD",
		RecordCount: recordCount,
	}, nil
}

func (r *Repository) GetCostTrendByEntity(ctx context.Context, tenantID string, entityType models.CostEntityType, entityID string, period string, category *string) ([]models.TrendPoint, error) {
	where := "WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3"
	args := []interface{}{tenantID, entityType, entityID}
	argIdx := 4
	if category != nil && *category != "" {
		where += fmt.Sprintf(" AND category = $%d", argIdx)
		args = append(args, *category)
		argIdx++
	}
	query := fmt.Sprintf(`
		SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS period, SUM(amount) AS cost
		FROM finops_cost_records %s
		GROUP BY DATE_TRUNC('day', created_at)
		ORDER BY period
	`, where)
	var points []models.TrendPoint
	err := r.db.SelectContext(ctx, &points, query, args...)
	return points, err
}

func (r *Repository) GetCostSummary(ctx context.Context, tenantID string, period string) (*models.CostSummary, error) {
	var totalCost, computeCost, storageCost, networkCost, saasCost float64
	err := r.db.GetContext(ctx, &totalCost,
		`SELECT COALESCE(SUM(amount), 0) FROM finops_cost_records WHERE tenant_id=$1`, tenantID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	for _, cat := range []string{"compute", "storage", "network", "saas"} {
		var c float64
		err := r.db.GetContext(ctx, &c,
			`SELECT COALESCE(SUM(amount), 0) FROM finops_cost_records WHERE tenant_id=$1 AND category=$2`, tenantID, cat)
		if err != nil && err != sql.ErrNoRows {
			continue
		}
		switch cat {
		case "compute":
			computeCost = c
		case "storage":
			storageCost = c
		case "network":
			networkCost = c
		case "saas":
			saasCost = c
		}
	}
	return &models.CostSummary{
		TotalCost:   round2(totalCost),
		ComputeCost: round2(computeCost),
		StorageCost: round2(storageCost),
		NetworkCost: round2(networkCost),
		SaasCost:    round2(saasCost),
		Period:      period,
		Currency:    "USD",
		TenantID:    tenantID,
	}, nil
}

func (r *Repository) GetCostBreakdown(ctx context.Context, tenantID string, dimension string) ([]models.CostBreakdown, error) {
	var query string
	switch dimension {
	case "category":
		query = `SELECT category AS dimension_value, SUM(amount) AS cost, COUNT(*) AS record_count FROM finops_cost_records WHERE tenant_id=$1 GROUP BY category ORDER BY cost DESC`
	case "environment":
		query = `SELECT COALESCE(environment, 'default') AS dimension_value, SUM(amount) AS cost, COUNT(*) AS record_count FROM finops_cost_records WHERE tenant_id=$1 GROUP BY environment ORDER BY cost DESC`
	case "tenant":
		query = `SELECT tenant_id AS dimension_value, SUM(amount) AS cost, COUNT(*) AS record_count FROM finops_cost_records WHERE tenant_id=$1 GROUP BY tenant_id ORDER BY cost DESC`
	default:
		return nil, fmt.Errorf("unsupported breakdown dimension: %s", dimension)
	}
	var rows *sqlx.Rows
	var err error
	if dimension == "category" || dimension == "environment" {
		rows, err = r.db.QueryxContext(ctx, query, tenantID)
	} else if dimension == "tenant" {
		rows, err = r.db.QueryxContext(ctx, query, tenantID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var breakdowns []models.CostBreakdown
	// First get total for percentage calculation
	var totalCost float64
	_ = r.db.GetContext(ctx, &totalCost, `SELECT COALESCE(SUM(amount), 0) FROM finops_cost_records WHERE tenant_id=$1`, tenantID)

	for rows.Next() {
		var bd models.CostBreakdown
		bd.Dimension = dimension
		if err := rows.Scan(&bd.DimensionValue, &bd.Cost, &bd.RecordCount); err == nil {
			bd.Cost = round2(bd.Cost)
			if totalCost > 0 {
				bd.Percentage = round2((bd.Cost / totalCost) * 100)
			}
			breakdowns = append(breakdowns, bd)
		}
	}
	return breakdowns, nil
}

// ============================================================================
// Chargeback Report
// ============================================================================

func (r *Repository) GetChargebackReport(ctx context.Context, tenantID string, period string) (*models.ChargebackReport, error) {
	var totalCost float64
	err := r.db.GetContext(ctx, &totalCost,
		`SELECT COALESCE(SUM(amount), 0) FROM finops_cost_records WHERE tenant_id=$1`, tenantID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	var entities []models.ChargebackEntity
	rows, err := r.db.QueryContext(ctx,
		`SELECT entity_type, entity_id, SUM(amount) AS cost, COUNT(*) AS record_count FROM finops_cost_records WHERE tenant_id=$1 GROUP BY entity_type, entity_id ORDER BY cost DESC`, tenantID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var entityType, entityID string
			var cost float64
			var recordCount int
			if err := rows.Scan(&entityType, &entityID, &cost, &recordCount); err == nil {
				percentage := 0.0
				if totalCost > 0 {
					percentage = round2((cost / totalCost) * 100)
				}
				entities = append(entities, models.ChargebackEntity{
					EntityType: models.CostEntityType(entityType),
					EntityID:   entityID,
					Cost:       round2(cost),
					Percentage: percentage,
					Breakdown:  make(map[string]float64),
				})
			}
		}
	}
	if entities == nil {
		entities = []models.ChargebackEntity{}
	}
	return &models.ChargebackReport{
		ID:          uuid.New().String(),
		GeneratedAt: time.Now().UTC(),
		Period:      period,
		TotalCost:   round2(totalCost),
		Entities:    entities,
		Currency:    "USD",
	}, nil
}

// ============================================================================
// Budget Status & Forecast
// ============================================================================

func (r *Repository) GetBudgetStatus(ctx context.Context, budgetID string, tenantID string) (*models.BudgetStatus, error) {
	var b models.Budget
	err := r.db.GetContext(ctx, &b, `SELECT * FROM finops_budgets WHERE id=$1 AND tenant_id=$2`, budgetID, tenantID)
	if err != nil {
		return nil, err
	}
	var currentSpend float64
	err = r.db.GetContext(ctx, &currentSpend,
		`SELECT COALESCE(SUM(amount), 0) FROM finops_cost_records WHERE tenant_id=$1 AND entity_type=$2 AND entity_id=$3`,
		tenantID, b.EntityType, b.EntityID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	remaining := b.Amount - currentSpend
	usagePercent := 0.0
	if b.Amount > 0 {
		usagePercent = (currentSpend / b.Amount) * 100
	}
	overBudget := currentSpend > b.Amount

	return &models.BudgetStatus{
		BudgetID:       budgetID,
		EntityType:     string(b.EntityType),
		EntityID:       b.EntityID,
		BudgetAmount:   b.Amount,
		CurrentSpend:   round2(currentSpend),
		UsagePercent:   round2(usagePercent),
		Remaining:      round2(remaining),
		Period:         b.Period,
		OverBudget:     overBudget,
		TriggeredAlerts: []models.BudgetAlertTrigger{},
	}, nil
}

// ============================================================================
// ROI Analysis
// ============================================================================

func (r *Repository) CreateROIAnalysis(ctx context.Context, tenantID string, roi *models.ROIAnalysis) error {
	roi.ID = uuid.New().String()
	roi.TenantID = tenantID
	roi.AnalyzedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO finops_roi_analyses (id, tenant_id, investment_type, name, cost, savings, period, roi_percentage, payback_months, description, details, analyzed_at)
		 VALUES (:id, :tenantId, :investmentType, :name, :cost, :savings, :period, :roiPercentage, :paybackMonths, :description, :details, :analyzedAt)`,
		roi)
	return err
}

func (r *Repository) ListROIAnalyses(ctx context.Context, tenantID string, investmentType *string, minROI *float64) ([]models.ROIAnalysis, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if investmentType != nil && *investmentType != "" {
		where += fmt.Sprintf(" AND investment_type = $%d", argIdx)
		args = append(args, *investmentType)
		argIdx++
	}
	if minROI != nil {
		where += fmt.Sprintf(" AND roi_percentage >= $%d", argIdx)
		args = append(args, *minROI)
		argIdx++
	}
	var rois []models.ROIAnalysis
	err := r.db.SelectContext(ctx, &rois,
		fmt.Sprintf(`SELECT * FROM finops_roi_analyses %s ORDER BY analyzed_at DESC`, where), args...)
	return rois, err
}

func (r *Repository) GetROISummary(ctx context.Context, tenantID string) (*models.ROISummary, error) {
	var totalAnalyses int
	var averageROI float64
	var averagePaybackMonths float64
	var totalSavings float64
	_ = r.db.GetContext(ctx, &totalAnalyses, `SELECT COUNT(*) FROM finops_roi_analyses WHERE tenant_id=$1`, tenantID)
	_ = r.db.GetContext(ctx, &averageROI, `SELECT COALESCE(AVG(roi_percentage), 0) FROM finops_roi_analyses WHERE tenant_id=$1`, tenantID)
	_ = r.db.GetContext(ctx, &averagePaybackMonths, `SELECT COALESCE(AVG(payback_months), 0) FROM finops_roi_analyses WHERE tenant_id=$1`, tenantID)
	_ = r.db.GetContext(ctx, &totalSavings, `SELECT COALESCE(SUM(savings), 0) FROM finops_roi_analyses WHERE tenant_id=$1`, tenantID)
	return &models.ROISummary{
		TotalAnalyses:        totalAnalyses,
		AverageROI:           round2(averageROI),
		AveragePaybackMonths: round2(averagePaybackMonths),
		TotalSavings:         round2(totalSavings),
	}, nil
}

// ============================================================================
// Cost Period Comparison
// ============================================================================

func (r *Repository) CreateCostComparison(ctx context.Context, tenantID string, c *models.CostPeriodComparison) error {
	c.ID = uuid.New().String()
	c.TenantID = tenantID
	c.CreatedAt = time.Now().UTC()
	if c.SavingsPercent == 0 {
		c.Savings = c.BeforeCost - c.AfterCost
		if c.BeforeCost > 0 {
			c.SavingsPercent = (c.Savings / c.BeforeCost) * 100
		}
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO finops_cost_comparisons (id, tenant_id, description, before_cost, after_cost, savings, savings_percent, time_savings_hours, period, created_at)
		 VALUES (:id, :tenantId, :description, :beforeCost, :afterCost, :savings, :savingsPercent, :timeSavingsHours, :period, :createdAt)`,
		c)
	return err
}

func (r *Repository) ListCostComparisons(ctx context.Context, tenantID string, period *string) ([]models.CostPeriodComparison, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if period != nil && *period != "" {
		where += fmt.Sprintf(" AND period = $%d", argIdx)
		args = append(args, *period)
	}
	var comparisons []models.CostPeriodComparison
	err := r.db.SelectContext(ctx, &comparisons,
		fmt.Sprintf(`SELECT * FROM finops_cost_comparisons %s ORDER BY created_at DESC`, where), args...)
	return comparisons, err
}

// ============================================================================
// Optimizations (full CRUD)
// ============================================================================

func (r *Repository) CreateOptimization(ctx context.Context, tenantID string, opt *models.OptimizationSuggestion) error {
	opt.ID = uuid.New().String()
	opt.TenantID = tenantID
	now := time.Now().UTC()
	opt.CreatedAt = now
	opt.UpdatedAt = &now
	if opt.Status == "" {
		opt.Status = string(models.OptStatusIdentified)
	}
	if opt.Priority == "" {
		opt.Priority = string(models.OptPriorityMedium)
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO finops_optimizations (id, tenant_id, service, category, description, potential_savings, priority, entity_id, entity_type, resource_ids, notes, effort, status, created_at, updated_at)
		 VALUES (:id, :tenantId, :service, :category, :description, :potentialSavings, :priority, :entityId, :entityType, :resourceIds, :notes, :effort, :status, :createdAt, :updatedAt)`,
		opt)
	return err
}

func (r *Repository) ListOptimizations(ctx context.Context, tenantID string, category *string, priority *string, status *string, entityType *string, entityID *string, minSavings *float64) ([]models.OptimizationSuggestion, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if category != nil && *category != "" {
		where += fmt.Sprintf(" AND category = $%d", argIdx)
		args = append(args, *category)
		argIdx++
	}
	if priority != nil && *priority != "" {
		where += fmt.Sprintf(" AND priority = $%d", argIdx)
		args = append(args, *priority)
		argIdx++
	}
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *status)
		argIdx++
	}
	if entityType != nil && *entityType != "" {
		where += fmt.Sprintf(" AND entity_type = $%d", argIdx)
		args = append(args, *entityType)
		argIdx++
	}
	if entityID != nil && *entityID != "" {
		where += fmt.Sprintf(" AND entity_id = $%d", argIdx)
		args = append(args, *entityID)
		argIdx++
	}
	if minSavings != nil {
		where += fmt.Sprintf(" AND potential_savings >= $%d", argIdx)
		args = append(args, *minSavings)
	}
	var opts []models.OptimizationSuggestion
	err := r.db.SelectContext(ctx, &opts,
		fmt.Sprintf(`SELECT * FROM finops_optimizations %s ORDER BY created_at DESC`, where), args...)
	return opts, err
}

func (r *Repository) GetOptimization(ctx context.Context, id string, tenantID string) (*models.OptimizationSuggestion, error) {
	var opt models.OptimizationSuggestion
	err := r.db.GetContext(ctx, &opt,
		`SELECT * FROM finops_optimizations WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &opt, nil
}

func (r *Repository) UpdateOptimizationStatus(ctx context.Context, id string, tenantID string, status string, notes *string) (bool, error) {
	now := time.Now().UTC()
	var result sql.Result
	var err error
	if notes != nil {
		result, err = r.db.ExecContext(ctx,
			`UPDATE finops_optimizations SET status=$1, notes=$2, updated_at=$3 WHERE id=$4 AND tenant_id=$5`,
			status, *notes, now, id, tenantID)
	} else {
		// Use empty string to avoid NULL mismatch; the DB column is nullable
		result, err = r.db.ExecContext(ctx,
			`UPDATE finops_optimizations SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
			status, now, id, tenantID)
	}
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

func (r *Repository) DeleteOptimization(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM finops_optimizations WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// ============================================================================
// Cost Forecast
// ============================================================================

func (r *Repository) GetCostRecordsForForecast(ctx context.Context, tenantID string, days int) ([]models.CostRecord, error) {
	var records []models.CostRecord
	err := r.db.SelectContext(ctx, &records,
		fmt.Sprintf(`SELECT * FROM finops_cost_records WHERE tenant_id=$1 AND created_at >= NOW() - INTERVAL '%d days' ORDER BY created_at ASC`, days), tenantID)
	return records, err
}

// ============================================================================
// Helpers
// ============================================================================

func buildUpdateSet(updates map[string]interface{}) (string, []interface{}, error) {
	if len(updates) == 0 {
		return "", nil, sentinel.NotFound
	}
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	return strings.Join(setClauses, ", "), args, nil
}

func buildUpdateSetWithPrefix(updates map[string]interface{}) (string, []interface{}, error) {
	// Same as buildUpdateSet but without prefix - used for UPDATE ... SET clauses
	return buildUpdateSet(updates)
}

// escapeLike escapes special LIKE characters.
func escapeLike(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return s
}

// round2 rounds a float64 to 2 decimal places.
func round2(f float64) float64 {
	return float64(int(f*100+0.5)) / 100
}

// parseJSONField attempts to parse a JSON string field, returns empty string on failure.
func parseJSONField(s string) string {
	if s == "" || s == "null" {
		return "{}"
	}
	if !strings.HasPrefix(s, "{") && !strings.HasPrefix(s, "[") {
		return "{}"
	}
	return s
}

// isValidUUID checks if a string is a valid UUID format.
func isValidUUID(s string) bool {
	match, _ := regexp.MatchString(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`, strings.ToLower(s))
	return match
}

// parseFloat64 safely parses a float64 from string.
func parseFloat64(s string) (float64, error) {
	return strconv.ParseFloat(s, 64)
}

// parseInt safely parses an int from string.
func parseInt(s string) (int, error) {
	return strconv.Atoi(s)
}

// sanitizeEntityType validates and returns the entity type.
func sanitizeEntityType(t string) (models.CostEntityType, error) {
	et := models.CostEntityType(t)
	if validEntityType(et) {
		return et, nil
	}
	return "", fmt.Errorf("invalid entity type: %s", t)
}

// sanitizeBudgetStatus validates budget status string.
func sanitizeBudgetStatus(s string) (string, error) {
	valid := map[string]bool{
		"draft": true, "pending": true, "paid": true, "overdue": true, "cancelled": true,
	}
	if valid[s] {
		return s, nil
	}
	return "", fmt.Errorf("invalid budget status: %s", s)
}

// sanitizeOptimizationStatus validates optimization status string.
func sanitizeOptimizationStatus(s string) (models.OptimizationStatus, error) {
	valid := map[string]models.OptimizationStatus{
		"identified":  models.OptStatusIdentified,
		"reviewing":   models.OptStatusReviewing,
		"approved":    models.OptStatusApproved,
		"in-progress": models.OptStatusInProgress,
		"completed":   models.OptStatusCompleted,
		"rejected":    models.OptStatusRejected,
	}
	if status, ok := valid[s]; ok {
		return status, nil
	}
	return "", fmt.Errorf("invalid optimization status: %s", s)
}

// formatPeriod converts a period string to a readable format.
func formatPeriod(p string) string {
	if strings.Contains(p, "-") {
		// Already in YYYY-MM format
		return p
	}
	return p
}
