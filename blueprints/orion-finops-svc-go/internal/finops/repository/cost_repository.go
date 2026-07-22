package repository

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"time"

	"orion/finops-svc-go/internal/finops/models"

	"github.com/jmoiron/sqlx"
	"github.com/google/uuid"
)

// CostRepository provides data access for all FinOps entities.
type CostRepository struct {
	db *sqlx.DB
}

func NewCostRepository(db *sqlx.DB) *CostRepository {
	return &CostRepository{db: db}
}

// ==================== Cloud Costs ====================

func (r *CostRepository) CreateCloudCost(ctx context.Context, c *models.CloudCost) error {
	query := `INSERT INTO cloud_costs (id, tenant_id, resource_type, resource_id, provider, region, service, cost_cents, currency, usage_amount, usage_unit, period_start, period_end, tags)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`
	_, err := r.db.ExecContext(ctx, query, c.ID, c.TenantID, c.ResourceType, c.ResourceID, c.Provider, c.Region, c.Service, c.CostCents, c.Currency, c.UsageAmount, c.UsageUnit, c.PeriodStart, c.PeriodEnd, c.Tags)
	return err
}

func (r *CostRepository) CreateK8sCost(ctx context.Context, c *models.K8sCost) error {
	query := `INSERT INTO k8s_costs (id, tenant_id, cluster, namespace, workload, workload_type, cpu_cost_cents, mem_cost_cents, storage_cost_cents, total_cost_cents, currency, cpu_usage, mem_usage, period_start, period_end)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`
	_, err := r.db.ExecContext(ctx, query, c.ID, c.TenantID, c.Cluster, c.Namespace, c.Workload, c.WorkloadType, c.CPUCostCents, c.MemCostCents, c.StorageCostCents, c.TotalCostCents, c.Currency, c.CPUUsage, c.MemUsage, c.PeriodStart, c.PeriodEnd)
	return err
}

func (r *CostRepository) CreateSaaSCost(ctx context.Context, c *models.SaaSCost) error {
	query := `INSERT INTO saas_costs (id, tenant_id, provider, plan, seats_used, seats_total, cost_cents, currency, period_start, period_end)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`
	_, err := r.db.ExecContext(ctx, query, c.ID, c.TenantID, c.Provider, c.Plan, c.SeatsUsed, c.SeatsTotal, c.CostCents, c.Currency, c.PeriodStart, c.PeriodEnd)
	return err
}

// ==================== Cost Summary & Aggregation ====================

func (r *CostRepository) GetCostSummary(ctx context.Context, tenantID string, periodStart, periodEnd string) (*models.CostSummary, error) {
	summary := &models.CostSummary{Currency: "USD"}

	err := r.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(cost_cents),0) FROM cloud_costs WHERE tenant_id=$1 AND period_start>=$2 AND period_end<=$3`, tenantID, periodStart, periodEnd).Scan(&summary.CloudCostCents)
	if err != nil {
		return nil, err
	}

	err = r.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(total_cost_cents),0) FROM k8s_costs WHERE tenant_id=$1 AND period_start>=$2 AND period_end<=$3`, tenantID, periodStart, periodEnd).Scan(&summary.K8sCostCents)
	if err != nil {
		return nil, err
	}

	err = r.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(cost_cents),0) FROM saas_costs WHERE tenant_id=$1 AND period_start>=$2 AND period_end<=$3`, tenantID, periodStart, periodEnd).Scan(&summary.SaaSCostCents)
	if err != nil {
		return nil, err
	}

	summary.TotalCostCents = summary.CloudCostCents + summary.K8sCostCents + summary.SaaSCostCents
	return summary, nil
}

// GetCostByService aggregates cloud costs by service name for a given period.
func (r *CostRepository) GetCostByService(ctx context.Context, tenantID, periodStart, periodEnd string) ([]models.CostByService, error) {
	query := `SELECT service, COALESCE(SUM(cost_cents),0) as cost_cents, COUNT(*) as record_count
		FROM cloud_costs
		WHERE tenant_id=$1 AND period_start>=$2 AND period_end<=$3
		GROUP BY service
		ORDER BY cost_cents DESC`

	rows, err := r.db.QueryContext(ctx, query, tenantID, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.CostByService
	var totalCents int64
	for rows.Next() {
		var s models.CostByService
		if err := rows.Scan(&s.Service, &s.CostCents, &s.RecordCount); err != nil {
			return nil, err
		}
		totalCents += s.CostCents
		results = append(results, s)
	}

	// Calculate percentages
	for i := range results {
		if totalCents > 0 {
			results[i].Percentage = float64(results[i].CostCents) / float64(totalCents) * 100
		}
	}

	return results, rows.Err()
}

// GetCostTrend retrieves daily cost aggregation for trend analysis.
func (r *CostRepository) GetCostTrend(ctx context.Context, tenantID string, periodStart, periodEnd string) ([]models.CostTrendPoint, error) {
	query := `
		SELECT date, COALESCE(SUM(cost_cents),0) as cost_cents FROM (
			SELECT DATE(period_start) as date, cost_cents FROM cloud_costs
			WHERE tenant_id=$1 AND period_start>=$2 AND period_end<=$3
			UNION ALL
			SELECT DATE(period_start) as date, total_cost_cents as cost_cents FROM k8s_costs
			WHERE tenant_id=$1 AND period_start>=$2 AND period_end<=$3
			UNION ALL
			SELECT DATE(period_start) as date, cost_cents FROM saas_costs
			WHERE tenant_id=$1 AND period_start>=$2 AND period_end<=$3
		) combined
		GROUP BY date
		ORDER BY date`

	rows, err := r.db.QueryContext(ctx, query, tenantID, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []models.CostTrendPoint
	for rows.Next() {
		var p models.CostTrendPoint
		var date time.Time
		if err := rows.Scan(&date, &p.CostCents); err != nil {
			return nil, err
		}
		p.Date = date.Format("2006-01-02")
		points = append(points, p)
	}

	// Calculate change rates
	for i := range points {
		if i > 0 && points[i-1].CostCents > 0 {
			points[i].ChangeRate = float64(points[i].CostCents-points[i-1].CostCents) / float64(points[i-1].CostCents) * 100
		}
	}

	return points, rows.Err()
}

// GetK8sCostsByNamespace aggregates K8s costs by namespace.
func (r *CostRepository) GetK8sCostsByNamespace(ctx context.Context, tenantID, periodStart, periodEnd string) ([]models.CostByService, error) {
	query := `SELECT namespace as service, COALESCE(SUM(total_cost_cents),0) as cost_cents, COUNT(*) as record_count
		FROM k8s_costs
		WHERE tenant_id=$1 AND period_start>=$2 AND period_end<=$3
		GROUP BY namespace
		ORDER BY cost_cents DESC`

	rows, err := r.db.QueryContext(ctx, query, tenantID, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.CostByService
	var totalCents int64
	for rows.Next() {
		var s models.CostByService
		if err := rows.Scan(&s.Service, &s.CostCents, &s.RecordCount); err != nil {
			return nil, err
		}
		totalCents += s.CostCents
		results = append(results, s)
	}

	for i := range results {
		if totalCents > 0 {
			results[i].Percentage = float64(results[i].CostCents) / float64(totalCents) * 100
		}
	}

	return results, rows.Err()
}

// ==================== Budget Management ====================

// CreateBudget creates a new budget with optional thresholds.
func (r *CostRepository) CreateBudget(ctx context.Context, b *models.Budget, thresholds []int) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	query := `INSERT INTO budgets (id, tenant_id, entity_type, entity_id, name, amount_cents, currency, period, environment, description, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`
	_, err = tx.ExecContext(ctx, query, b.ID, b.TenantID, b.EntityType, b.EntityID, b.Name, b.AmountCents, b.Currency, b.Period, b.Environment, b.Description, b.Status)
	if err != nil {
		return err
	}

	// Insert thresholds
	for _, pct := range thresholds {
		t := &models.BudgetThreshold{
			ID:         uuid.New().String(),
			BudgetID:   b.ID,
			Percentage: pct,
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO budget_thresholds (id, budget_id, percentage) VALUES ($1,$2,$3)`,
			t.ID, t.BudgetID, t.Percentage)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// GetBudget retrieves a budget by ID.
func (r *CostRepository) GetBudget(ctx context.Context, tenantID, id string) (*models.Budget, error) {
	var b models.Budget
	err := r.db.GetContext(ctx, &b, `SELECT * FROM budgets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// ListBudgets retrieves budgets for a tenant.
func (r *CostRepository) ListBudgets(ctx context.Context, tenantID string, offset, limit int) ([]models.Budget, error) {
	var budgets []models.Budget
	query := `SELECT * FROM budgets WHERE tenant_id=$1 AND status != 'deleted' ORDER BY created_at DESC OFFSET $2 LIMIT $3`
	err := r.db.SelectContext(ctx, &budgets, query, tenantID, offset, limit)
	return budgets, err
}

// UpdateBudget updates a budget.
func (r *CostRepository) UpdateBudget(ctx context.Context, b *models.Budget) error {
	query := `UPDATE budgets SET name=$1, amount_cents=$2, period=$3, environment=$4, description=$5, updated_at=NOW() WHERE id=$6 AND tenant_id=$7`
	_, err := r.db.ExecContext(ctx, query, b.Name, b.AmountCents, b.Period, b.Environment, b.Description, b.ID, b.TenantID)
	return err
}

// DeleteBudget soft-deletes a budget.
func (r *CostRepository) DeleteBudget(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE budgets SET status='deleted', updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// GetBudgetThresholds retrieves thresholds for a budget.
func (r *CostRepository) GetBudgetThresholds(ctx context.Context, budgetID string) ([]models.BudgetThreshold, error) {
	var thresholds []models.BudgetThreshold
	err := r.db.SelectContext(ctx, &thresholds, `SELECT * FROM budget_thresholds WHERE budget_id=$1 ORDER BY percentage`, budgetID)
	return thresholds, err
}

// UpdateBudgetThreshold updates the triggered status of a threshold.
func (r *CostRepository) UpdateBudgetThreshold(ctx context.Context, id string, triggered bool) error {
	_, err := r.db.ExecContext(ctx, `UPDATE budget_thresholds SET triggered=$1, triggered_at=CASE WHEN $1 THEN NOW() ELSE triggered_at END WHERE id=$2`, triggered, id)
	return err
}

// RecordBudgetSpend records a spend against a budget.
func (r *CostRepository) RecordBudgetSpend(ctx context.Context, budgetID string, amountCents int64) error {
	id := uuid.New().String()
	_, err := r.db.ExecContext(ctx, `INSERT INTO budget_spends (id, budget_id, amount_cents) VALUES ($1,$2,$3)`, id, budgetID, amountCents)
	return err
}

// GetTotalBudgetSpend returns the total spend for a budget.
func (r *CostRepository) GetTotalBudgetSpend(ctx context.Context, budgetID string) (int64, error) {
	var total int64
	err := r.db.GetContext(ctx, &total, `SELECT COALESCE(SUM(amount_cents),0) FROM budget_spends WHERE budget_id=$1`, budgetID)
	return total, err
}

// GetBudgetSpendHistory returns spend records for a budget ordered by time.
func (r *CostRepository) GetBudgetSpendHistory(ctx context.Context, budgetID string) ([]models.BudgetSpend, error) {
	var spends []models.BudgetSpend
	err := r.db.SelectContext(ctx, &spends, `SELECT * FROM budget_spends WHERE budget_id=$1 ORDER BY recorded_at`, budgetID)
	return spends, err
}

// InsertBudgetAlertTrigger records a triggered alert event.
func (r *CostRepository) InsertBudgetAlertTrigger(ctx context.Context, t *models.BudgetAlertTrigger) error {
	query := `INSERT INTO budget_alert_triggers (id, budget_id, threshold_pct, actual_cents, usage_pct, entity_type, entity_id)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`
	_, err := r.db.ExecContext(ctx, query, t.ID, t.BudgetID, t.ThresholdPct, t.ActualCents, t.UsagePct, t.EntityType, t.EntityID)
	return err
}

// GetBudgetAlertTriggers retrieves alert triggers for a budget.
func (r *CostRepository) GetBudgetAlertTriggers(ctx context.Context, budgetID string) ([]models.BudgetAlertTrigger, error) {
	var triggers []models.BudgetAlertTrigger
	err := r.db.SelectContext(ctx, &triggers, `SELECT * FROM budget_alert_triggers WHERE budget_id=$1 ORDER BY triggered_at DESC`, budgetID)
	return triggers, err
}

// GetAllBudgetAlertTriggers retrieves all alert triggers for a tenant.
func (r *CostRepository) GetAllBudgetAlertTriggers(ctx context.Context, tenantID string) ([]models.BudgetAlertTrigger, error) {
	var triggers []models.BudgetAlertTrigger
	query := `SELECT t.* FROM budget_alert_triggers t
		JOIN budgets b ON t.budget_id = b.id
		WHERE b.tenant_id=$1
		ORDER BY t.triggered_at DESC`
	err := r.db.SelectContext(ctx, &triggers, query, tenantID)
	return triggers, err
}

// ==================== Legacy Budget Alerts ====================

func (r *CostRepository) ListBudgetAlerts(ctx context.Context, tenantID string, offset, limit int) ([]models.BudgetAlert, error) {
	var alerts []models.BudgetAlert
	query := `SELECT id, tenant_id, name, budget_cents, threshold_pct, current_spend_cents, status, notify_email, period, last_triggered_at, created_at, updated_at
		FROM budget_alerts WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`
	err := r.db.SelectContext(ctx, &alerts, query, tenantID, offset, limit)
	return alerts, err
}

func (r *CostRepository) CreateBudgetAlert(ctx context.Context, a *models.BudgetAlert) error {
	query := `INSERT INTO budget_alerts (id, tenant_id, name, budget_cents, threshold_pct, current_spend_cents, status, notify_email, period)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`
	_, err := r.db.ExecContext(ctx, query, a.ID, a.TenantID, a.Name, a.BudgetCents, a.ThresholdPct, a.CurrentSpendCents, a.Status, a.NotifyEmail, a.Period)
	return err
}

func (r *CostRepository) UpdateBudgetAlert(ctx context.Context, a *models.BudgetAlert) error {
	query := `UPDATE budget_alerts SET name=$1, budget_cents=$2, threshold_pct=$3, notify_email=$4, status=$5, updated_at=NOW() WHERE id=$6 AND tenant_id=$7`
	_, err := r.db.ExecContext(ctx, query, a.Name, a.BudgetCents, a.ThresholdPct, a.NotifyEmail, a.Status, a.ID, a.TenantID)
	return err
}

func (r *CostRepository) GetBudgetAlertByID(ctx context.Context, tenantID, id string) (*models.BudgetAlert, error) {
	var a models.BudgetAlert
	err := r.db.GetContext(ctx, &a, `SELECT * FROM budget_alerts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// UpdateBudgetAlertSpend updates the current spend for a budget alert.
func (r *CostRepository) UpdateBudgetAlertSpend(ctx context.Context, id string, spendCents int64) error {
	_, err := r.db.ExecContext(ctx, `UPDATE budget_alerts SET current_spend_cents=$1, last_triggered_at=NOW(), status='triggered', updated_at=NOW() WHERE id=$2`, spendCents, id)
	return err
}

func (r *CostRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM cloud_costs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *CostRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM cloud_costs WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ==================== Cost Optimization ====================

// CreateOptimization creates a cost optimization suggestion.
func (r *CostRepository) CreateOptimization(ctx context.Context, o *models.CostOptimization) error {
	query := `INSERT INTO cost_optimizations (id, tenant_id, category, description, estimated_savings_cents, effort, priority, status, resource_ids, entity_type, entity_id, notes)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`
	_, err := r.db.ExecContext(ctx, query, o.ID, o.TenantID, o.Category, o.Description, o.EstimatedSavingsCents, o.Effort, o.Priority, o.Status, o.ResourceIDs, o.EntityType, o.EntityID, o.Notes)
	return err
}

// BatchCreateOptimizations creates multiple optimization suggestions in a transaction.
func (r *CostRepository) BatchCreateOptimizations(ctx context.Context, opts []models.CostOptimization) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	query := `INSERT INTO cost_optimizations (id, tenant_id, category, description, estimated_savings_cents, effort, priority, status, resource_ids, entity_type, entity_id, notes)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`
	for _, o := range opts {
		_, err := tx.ExecContext(ctx, query, o.ID, o.TenantID, o.Category, o.Description, o.EstimatedSavingsCents, o.Effort, o.Priority, o.Status, o.ResourceIDs, o.EntityType, o.EntityID, o.Notes)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// GetOptimizations retrieves optimization suggestions with optional filters.
func (r *CostRepository) GetOptimizations(ctx context.Context, tenantID string, category models.OptimizationCategory, status models.OptimizationStatus) ([]models.CostOptimization, error) {
	query := `SELECT * FROM cost_optimizations WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	argIdx := 2

	if category != "" {
		query += fmt.Sprintf(` AND category=$%d`, argIdx)
		args = append(args, category)
		argIdx++
	}
	if status != "" {
		query += fmt.Sprintf(` AND status=$%d`, argIdx)
		args = append(args, status)
		argIdx++
	}

	query += ` ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, created_at DESC`

	var opts []models.CostOptimization
	err := r.db.SelectContext(ctx, &opts, query, args...)
	return opts, err
}

// UpdateOptimizationStatus updates the status of an optimization suggestion.
func (r *CostRepository) UpdateOptimizationStatus(ctx context.Context, tenantID, id string, status models.OptimizationStatus) error {
	_, err := r.db.ExecContext(ctx, `UPDATE cost_optimizations SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, status, id, tenantID)
	return err
}

// DeleteOptimization deletes an optimization suggestion.
func (r *CostRepository) DeleteOptimization(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM cost_optimizations WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// GetOptimizationSavings returns the total estimated savings grouped by category.
func (r *CostRepository) GetOptimizationSavings(ctx context.Context, tenantID string, category models.OptimizationCategory, status models.OptimizationStatus) (*models.SavingsEstimate, error) {
	query := `SELECT category, COALESCE(SUM(estimated_savings_cents),0) as total, COUNT(*) as cnt
		FROM cost_optimizations WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	argIdx := 2

	if category != "" {
		query += fmt.Sprintf(` AND category=$%d`, argIdx)
		args = append(args, category)
		argIdx++
	}
	if status != "" {
		query += fmt.Sprintf(` AND status=$%d`, argIdx)
		args = append(args, status)
		argIdx++
	}

	query += ` GROUP BY category`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	estimate := &models.SavingsEstimate{
		ByCategory: make(map[string]int64),
	}

	for rows.Next() {
		var cat string
		var total int64
		var cnt int
		if err := rows.Scan(&cat, &total, &cnt); err != nil {
			return nil, err
		}
		estimate.ByCategory[cat] = total
		estimate.TotalMonthlySavingsCents += total
		estimate.SuggestionCount += cnt
	}

	estimate.TotalAnnualSavingsCents = estimate.TotalMonthlySavingsCents * 12
	return estimate, rows.Err()
}

// ==================== Resource Utilization ====================

// RecordResourceUtilization records a resource utilization data point.
func (r *CostRepository) RecordResourceUtilization(ctx context.Context, u *models.ResourceUtilization) error {
	query := `INSERT INTO resource_utilizations (id, tenant_id, resource_id, resource_type, resource_name, cpu_utilization, memory_utilization, storage_utilization, monthly_cost_cents, environment)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`
	_, err := r.db.ExecContext(ctx, query, u.ID, u.TenantID, u.ResourceID, u.ResourceType, u.ResourceName, u.CPUUtilization, u.MemoryUtilization, u.StorageUtilization, u.MonthlyCostCents, u.Environment)
	return err
}

// GetResourceUtilizations retrieves the latest utilization for each resource.
func (r *CostRepository) GetResourceUtilizations(ctx context.Context, tenantID string) ([]models.ResourceUtilization, error) {
	query := `SELECT DISTINCT ON (resource_id) *
		FROM resource_utilizations
		WHERE tenant_id=$1
		ORDER BY resource_id, recorded_at DESC`

	var utils []models.ResourceUtilization
	err := r.db.SelectContext(ctx, &utils, query, tenantID)
	return utils, err
}

// GetUnusedResources retrieves resources with utilization below 5%.
func (r *CostRepository) GetUnusedResources(ctx context.Context, tenantID string) ([]models.ResourceUtilization, error) {
	query := `SELECT DISTINCT ON (resource_id) *
		FROM resource_utilizations
		WHERE tenant_id=$1 AND cpu_utilization < 5 AND memory_utilization < 5 AND storage_utilization < 5
		ORDER BY resource_id, recorded_at DESC`

	var utils []models.ResourceUtilization
	err := r.db.SelectContext(ctx, &utils, query, tenantID)
	return utils, err
}

// BatchRecordResourceUtilizations records multiple utilization data points.
func (r *CostRepository) BatchRecordResourceUtilizations(ctx context.Context, utils []models.ResourceUtilization) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	query := `INSERT INTO resource_utilizations (id, tenant_id, resource_id, resource_type, resource_name, cpu_utilization, memory_utilization, storage_utilization, monthly_cost_cents, environment)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`
	for _, u := range utils {
		_, err := tx.ExecContext(ctx, query, u.ID, u.TenantID, u.ResourceID, u.ResourceType, u.ResourceName, u.CPUUtilization, u.MemoryUtilization, u.StorageUtilization, u.MonthlyCostCents, u.Environment)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// Ensure JSONB implements driver.Valuer and sql.Scanner for sqlx.
var _ driver.Valuer = (models.JSONB)(nil)
var _ sql.Scanner = (*models.JSONB)(nil)
