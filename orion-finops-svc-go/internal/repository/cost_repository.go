package repository

import (
	"context"

	"orion/finops-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// CostRepository provides data access for cost records.
type CostRepository struct {
	db *sqlx.DB
}

func NewCostRepository(db *sqlx.DB) *CostRepository {
	return &CostRepository{db: db}
}

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

func (r *CostRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM cloud_costs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *CostRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM cloud_costs WHERE tenant_id=$1`, tenantID)
	return count, err
}
