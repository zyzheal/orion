package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/finops-v2/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Cost tracking ---

func (r *Repository) TrackCost(ctx context.Context, e *models.CostEntry) (int, error) {
	var id int
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO finops_v2_costs (tenant_id, entity_id, entity_type, cost, currency, category, provider, period_start, period_end, details)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
		e.TenantID, e.EntityID, e.EntityType, e.Cost, e.Currency, e.Category, e.Provider, e.PeriodStart, e.PeriodEnd, e.Details).Scan(&id)
	return id, err
}

func (r *Repository) GetCostByEntity(ctx context.Context, tenantID, entityType, entityID string) ([]models.CostEntry, error) {
	var items []models.CostEntry
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM finops_v2_costs WHERE tenant_id=$1 AND entity_type=$2 AND entity_id=$3 ORDER BY period_start DESC`,
		tenantID, entityType, entityID)
	return items, err
}

func (r *Repository) GetEntityCostTrend(ctx context.Context, tenantID, entityType, entityID string) ([]models.CostTrendPoint, error) {
	var items []models.CostTrendPoint
	err := r.db.SelectContext(ctx, &items,
		`SELECT period_start AS period, cost FROM finops_v2_costs WHERE tenant_id=$1 AND entity_type=$2 AND entity_id=$3 ORDER BY period_start`,
		tenantID, entityType, entityID)
	return items, err
}

func (r *Repository) GetCostSummary(ctx context.Context, tenantID string) (*models.CostSummary, error) {
	// period is not a filter here: at the handler it is a display granularity
	// ("monthly"), so filtering by it would silently drop all rows. The service
	// echoes it into the response instead.
	cs := &models.CostSummary{TenantID: tenantID}
	err := r.db.GetContext(ctx, &cs.TotalCost,
		`SELECT COALESCE(SUM(cost), 0) FROM finops_v2_costs WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	// Cost by category
	var catItems []models.CostBreakdownItem
	err = r.db.SelectContext(ctx, &catItems,
		`SELECT category AS key, SUM(cost) AS cost FROM finops_v2_costs WHERE tenant_id=$1 GROUP BY category ORDER BY cost DESC`, tenantID)
	cs.CostByCategory = catItems

	// Cost by provider
	var provItems []models.CostBreakdownItem
	err = r.db.SelectContext(ctx, &provItems,
		`SELECT provider AS key, SUM(cost) AS cost FROM finops_v2_costs WHERE tenant_id=$1 GROUP BY provider ORDER BY cost DESC`, tenantID)
	cs.CostByProvider = provItems

	// Naive forecast: the next horizon window costs roughly what the last horizon
	// window cost. Multiplying the all-time total by a constant would grow with
	// the tenant's age instead of with its current run rate.
	window := time.Now().UTC().AddDate(0, 0, -forecastHorizonDays)
	err = r.db.GetContext(ctx, &cs.ForecastCost,
		`SELECT COALESCE(SUM(cost),0) FROM finops_v2_costs
		 WHERE tenant_id=$1 AND created_at >= $2`, tenantID, window)
	if err != nil {
		return nil, err
	}

	return cs, nil
}

func (r *Repository) GetCostBreakdown(ctx context.Context, tenantID, dimension string) ([]models.CostBreakdownItem, error) {
	var items []models.CostBreakdownItem
	col := "category"
	if dimension == "provider" {
		col = "provider"
	} else if dimension == "entity" {
		col = "entity_id"
	}
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s AS key, SUM(cost) AS cost FROM finops_v2_costs WHERE tenant_id=$1 GROUP BY %s ORDER BY cost DESC`, col, col),
		tenantID)
	return items, err
}

// --- Chargeback ---

func (r *Repository) GetChargebackReport(ctx context.Context, tenantID string) ([]models.ChargebackEntry, error) {
	var items []models.ChargebackEntry
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM finops_v2_chargebacks WHERE tenant_id=$1 ORDER BY allocated_cost DESC`, tenantID)
	return items, err
}

func (r *Repository) CreateChargeback(ctx context.Context, e *models.ChargebackEntry) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO finops_v2_chargebacks (tenant_id, entity_id, entity_type, allocated_cost, percentage, period)
		 VALUES (:tenant_id, :entity_id, :entity_type, :allocated_cost, :percentage, :period)`,
		e)
	return err
}

// --- Budget management ---

func (r *Repository) CreateBudget(ctx context.Context, budget *models.Budget) (int, error) {
	var id int
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO finops_v2_budgets (tenant_id, name, entity_id, entity_type, amount, period, currency, category, alert_threshold, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
		budget.TenantID, budget.Name, budget.EntityID, budget.EntityType, budget.Amount,
		budget.Period, budget.Currency, budget.Category, budget.AlertThreshold, budget.Status).Scan(&id)
	return id, err
}

func (r *Repository) GetBudget(ctx context.Context, tenantID, id string) (*models.Budget, error) {
	var b models.Budget
	err := r.db.GetContext(ctx, &b,
		`SELECT * FROM finops_v2_budgets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *Repository) ListBudgets(ctx context.Context, tenantID string, limit, offset int) ([]models.Budget, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Budget
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM finops_v2_budgets WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return items, err
}

func (r *Repository) UpdateBudget(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	// Append the value BEFORE computing the placeholder index: seeding args with a
	// timestamp used to shift every placeholder by one, so `name=$1` bound the
	// seed timestamp, `updated_at=$2` bound the name string, and the value
	// intended for $3 was left unbound.
	setParts := []string{}
	args := []interface{}{}
	for _, k := range []string{"name", "amount", "period", "currency", "category", "alert_threshold", "status", "updated_at"} {
		if v, ok := updates[k]; ok {
			args = append(args, v)
			setParts = append(setParts, fmt.Sprintf("%s=$%d", k, len(args)))
		}
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE finops_v2_budgets SET %s WHERE id=$%d AND tenant_id=$%d`,
		joinComma(setParts), len(args)-1, len(args))
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

func joinComma(parts []string) string {
	var b string
	for i, p := range parts {
		if i > 0 {
			b += ", "
		}
		b += p
	}
	return b
}

func (r *Repository) DeleteBudget(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM finops_v2_budgets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) GetBudgetStatus(ctx context.Context, tenantID, id string) (*models.BudgetStatusResponse, error) {
	b, err := r.GetBudget(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	// Compute used cost
	var usedCost float64
	err = r.db.GetContext(ctx, &usedCost,
		`SELECT COALESCE(SUM(cost),0) FROM finops_v2_costs WHERE tenant_id=$1 AND entity_id=$2 AND entity_type=$3`,
		tenantID, b.EntityID, b.EntityType)
	if err != nil {
		return nil, err
	}
	pct := 0.0
	if b.Amount > 0 {
		pct = (usedCost / b.Amount) * 100
	}
	status := "ok"
	if pct >= 100 {
		status = "exceeded"
	} else if pct >= b.AlertThreshold && b.AlertThreshold > 0 {
		status = "warning"
	}
	return &models.BudgetStatusResponse{
		BudgetID:       b.ID,
		UsedCost:       usedCost,
		AllocatedCost:  b.Amount,
		UtilizationPct: pct,
		RemainingCost:  b.Amount - usedCost,
		Status:         status,
	}, nil
}

// forecastHorizonDays is the look-back window the forecast baseline uses.
const forecastHorizonDays = 30

func (r *Repository) ForecastBudget(ctx context.Context, tenantID, id string) (*models.BudgetForecastResponse, error) {
	b, err := r.GetBudget(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	var usedCost float64
	err = r.db.GetContext(ctx, &usedCost,
		`SELECT COALESCE(SUM(cost),0) FROM finops_v2_costs WHERE tenant_id=$1 AND entity_id=$2 AND entity_type=$3`,
		tenantID, b.EntityID, b.EntityType)
	if err != nil {
		return nil, err
	}
	// usedCost is the entity's all-time spend, so it cannot be extrapolated into
	// the future. The baseline is the entity's own spend in the last
	// forecastHorizonDays days, added to what has already been spent.
	window := time.Now().UTC().AddDate(0, 0, -forecastHorizonDays)
	var recentCost float64
	err = r.db.GetContext(ctx, &recentCost,
		`SELECT COALESCE(SUM(cost),0) FROM finops_v2_costs
		 WHERE tenant_id=$1 AND entity_id=$2 AND entity_type=$3 AND created_at >= $4`,
		tenantID, b.EntityID, b.EntityType, window)
	if err != nil {
		return nil, err
	}
	projected := usedCost + recentCost

	overrun := 0.0
	if b.Amount > 0 {
		overrun = ((projected - b.Amount) / b.Amount) * 100
	}
	rec := "within budget"
	if overrun > 0 {
		rec = "reduce spend or raise the budget"
	} else if overrun > -20 {
		rec = "watch spend"
	}
	return &models.BudgetForecastResponse{
		BudgetID:           b.ID,
		ProjectedTotalCost: projected,
		RemainingDays:      forecastHorizonDays,
		OverrunLikelihood:  overrun,
		Recommendation:     rec,
	}, nil
}

// --- Budget alerts ---

func (r *Repository) CheckBudgetAlerts(ctx context.Context, tenantID, entityID, entityType string) ([]models.BudgetAlert, error) {
	// used_cost is computed from the tenant's own cost history for the budget's
	// entity, so the returned figure is a real number rather than a placeholder.
	// The entity filter is appended before computing the placeholder index: with
	// a fixed index one placeholder would be reused and one argument never bound
	// (defect class U — accepted by PostgreSQL, rejected only by a strict mock).
	where := "b.tenant_id=$1 AND b.status=$2"
	args := []interface{}{tenantID, "active"}
	if entityID != "" {
		args = append(args, entityID)
		where += fmt.Sprintf(" AND b.entity_id=$%d", len(args))
	}
	if entityType != "" {
		args = append(args, entityType)
		where += fmt.Sprintf(" AND b.entity_type=$%d", len(args))
	}
	var items []models.BudgetAlert
	err := r.db.SelectContext(ctx, &items,
		`SELECT b.id AS budget_id, b.name, b.alert_threshold AS threshold, 'warning' AS severity,
		 COALESCE((SELECT SUM(c.cost) FROM finops_v2_costs c
			 WHERE c.tenant_id=b.tenant_id AND c.entity_id=b.entity_id AND c.entity_type=b.entity_type), 0) AS used_cost
		 FROM finops_v2_budgets b
		 WHERE `+where+`
		 ORDER BY b.created_at DESC`, args...)
	return items, err
}

func (r *Repository) GetAlertTriggers(ctx context.Context, tenantID string) ([]models.AlertTrigger, error) {
	var items []models.AlertTrigger
	// tenant_id is filtered on both the trigger and the joined budget: joining on
	// id alone lets a trigger in one tenant read another tenant's budget name.
	err := r.db.SelectContext(ctx, &items,
		`SELECT a.budget_id, b.name, a.threshold, a.triggered_at
		 FROM finops_v2_alert_triggers a
		 JOIN finops_v2_budgets b ON b.id = a.budget_id AND b.tenant_id = a.tenant_id
		 WHERE a.tenant_id=$1
		 ORDER BY a.triggered_at DESC`,
		tenantID)
	return items, err
}

// --- Recommendations ---

func (r *Repository) ListRecommendations(ctx context.Context, tenantID string, limit, offset int) ([]models.Recommendation, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Recommendation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM finops_v2_recommendations WHERE tenant_id=$1 ORDER BY estimated_savings DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return items, err
}

func (r *Repository) GetRecommendation(ctx context.Context, tenantID string, id string) (*models.Recommendation, error) {
	var rec models.Recommendation
	err := r.db.GetContext(ctx, &rec,
		`SELECT * FROM finops_v2_recommendations WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *Repository) CreateRecommendation(ctx context.Context, rec *models.Recommendation) (int, error) {
	var id int
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO finops_v2_recommendations (tenant_id, type, title, description, estimated_savings, confidence, entity_id, entity_type, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
		rec.TenantID, rec.Type, rec.Title, rec.Description, rec.EstimatedSavings, rec.Confidence, rec.EntityID, rec.EntityType, rec.Status).Scan(&id)
	return id, err
}

func (r *Repository) UpdateRecommendationStatus(ctx context.Context, tenantID string, id string, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE finops_v2_recommendations SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		status, id, tenantID)
	return err
}

func (r *Repository) DeleteRecommendation(ctx context.Context, tenantID string, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM finops_v2_recommendations WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) GetRightSizingRecommendations(ctx context.Context, tenantID string) ([]models.Recommendation, error) {
	var items []models.Recommendation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM finops_v2_recommendations WHERE tenant_id=$1 AND type=$2 ORDER BY estimated_savings DESC`,
		tenantID, "right-sizing")
	return items, err
}

func (r *Repository) DetectUnusedResources(ctx context.Context, tenantID string) ([]models.Recommendation, error) {
	var items []models.Recommendation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM finops_v2_recommendations WHERE tenant_id=$1 AND type=$2 ORDER BY estimated_savings DESC`,
		tenantID, "unused")
	return items, err
}

func (r *Repository) EstimateSavings(ctx context.Context, tenantID string) (*models.SavingsEstimate, error) {
	var total float64
	err := r.db.GetContext(ctx, &total,
		`SELECT COALESCE(SUM(estimated_savings),0) FROM finops_v2_recommendations WHERE tenant_id=$1 AND status=$2`,
		tenantID, "open")
	if err != nil {
		return nil, err
	}
	var cats []models.CostBreakdownItem
	err = r.db.SelectContext(ctx, &cats,
		`SELECT type AS key, COALESCE(SUM(estimated_savings),0) AS cost FROM finops_v2_recommendations
		 WHERE tenant_id=$1 AND status=$2 GROUP BY type ORDER BY cost DESC`,
		tenantID, "open")
	if err != nil {
		return nil, err
	}
	optimization := make(map[string]float64, len(cats))
	for _, c := range cats {
		optimization[c.Key] = c.Cost
	}

	var confidence float64
	err = r.db.GetContext(ctx, &confidence,
		`SELECT COALESCE(AVG(confidence),0) FROM finops_v2_recommendations
		 WHERE tenant_id=$1 AND status=$2 AND confidence IS NOT NULL`,
		tenantID, "open")
	if err != nil {
		return nil, err
	}

	return &models.SavingsEstimate{
		TotalPotentialSavings:  total,
		OptimizationCategories: optimization,
		Confidence:             confidence,
		ReportedPeriod:         time.Now().UTC().Format(time.DateOnly),
	}, nil
}

// --- Reports ---

func (r *Repository) GetReportHistory(ctx context.Context, tenantID string) ([]models.Report, error) {
	var items []models.Report
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM finops_v2_reports WHERE tenant_id=$1 ORDER BY generated_at DESC`, tenantID)
	return items, err
}

func (r *Repository) CreateReport(ctx context.Context, report *models.Report) (int, error) {
	var id int
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO finops_v2_reports (tenant_id, name, type, period) VALUES ($1,$2,$3,$4) RETURNING id`,
		report.TenantID, report.Name, report.Type, report.Period).Scan(&id)
	return id, err
}

// --- ROI ---

func (r *Repository) GetROIHistory(ctx context.Context, tenantID string) ([]models.ROIEntry, error) {
	var items []models.ROIEntry
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM finops_v2_roi WHERE tenant_id=$1 ORDER BY period DESC`, tenantID)
	return items, err
}

func (r *Repository) GetROISummary(ctx context.Context, tenantID string) (*models.ROISummary, error) {
	summary := &models.ROISummary{}
	err := r.db.GetContext(ctx, &summary.TotalSpend,
		`SELECT COALESCE(SUM(total_spend),0) FROM finops_v2_roi WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	err = r.db.GetContext(ctx, &summary.TotalSavings,
		`SELECT COALESCE(SUM(total_savings),0) FROM finops_v2_roi WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	err = r.db.GetContext(ctx, &summary.ImplementedActions,
		`SELECT COALESCE(SUM(implemented_actions),0) FROM finops_v2_roi WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	summary.CurrentROI = 0
	if summary.TotalSpend > 0 {
		summary.CurrentROI = (summary.TotalSavings / summary.TotalSpend) * 100
	}
	return summary, nil
}

func (r *Repository) CreateROI(ctx context.Context, e *models.ROIEntry) (int, error) {
	var id int
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO finops_v2_roi (tenant_id, period, total_spend, total_savings, roi, implemented_actions)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		e.TenantID, e.Period, e.TotalSpend, e.TotalSavings, e.ROI, e.ImplementedActions).Scan(&id)
	return id, err
}

// --- Collection schedules ---

func (r *Repository) GetRegisteredProviders(ctx context.Context, tenantID string) ([]string, error) {
	var providers []string
	err := r.db.SelectContext(ctx, &providers,
		`SELECT DISTINCT provider FROM finops_v2_costs
		 WHERE tenant_id=$1 AND provider IS NOT NULL AND provider != ''
		 ORDER BY 1`,
		tenantID)
	return providers, err
}

func (r *Repository) SetSchedule(ctx context.Context, provider, cronExpression string, enabled bool) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO finops_v2_collection_schedules (provider, cron_expression, enabled)
		 VALUES ($1,$2,$3)
		 ON CONFLICT (provider) DO UPDATE SET cron_expression=$2, enabled=$3`,
		provider, cronExpression, enabled)
	return err
}

func (r *Repository) GetSchedule(ctx context.Context, provider string) (*models.CollectionSchedule, error) {
	var s models.CollectionSchedule
	err := r.db.GetContext(ctx, &s,
		`SELECT provider, cron_expression, enabled, last_run FROM finops_v2_collection_schedules WHERE provider=$1`,
		provider)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) CollectCost(ctx context.Context, tenantID string, provider string, days int) (*models.CollectCostResponse, error) {
	end := time.Now().UTC()
	start := end.AddDate(0, 0, -days)
	startStr := start.Format(time.DateOnly)
	endStr := end.Format(time.DateOnly)

	where := "tenant_id=$1 AND created_at >= $2 AND created_at <= $3"
	args := []interface{}{tenantID, start, end}

	if provider != "" {
		args = append(args, provider)
		where += fmt.Sprintf(" AND provider=$%d", len(args))
	}

	var collected int
	err := r.db.GetContext(ctx, &collected,
		fmt.Sprintf("SELECT COUNT(*) FROM finops_v2_costs WHERE %s", where), args...)
	if err != nil {
		return nil, err
	}

	var totalCost float64
	err = r.db.GetContext(ctx, &totalCost,
		fmt.Sprintf("SELECT COALESCE(SUM(cost), 0) FROM finops_v2_costs WHERE %s", where), args...)
	if err != nil {
		return nil, err
	}

	return &models.CollectCostResponse{
		Collected:   collected,
		TotalCost:   totalCost,
		Provider:    provider,
		PeriodStart: startStr,
		PeriodEnd:   endStr,
	}, nil
}

// --- Health check ---

func (r *Repository) HealthCheck(ctx context.Context) (bool, error) {
	// EXISTS reports whether the finops tables are reachable; the schema lives in
	// migrations/583, not in this package. LIMIT is not allowed inside EXISTS.
	var ok bool
	err := r.db.GetContext(ctx, &ok, `SELECT EXISTS(SELECT 1 FROM finops_v2_costs)`)
	return ok, err
}
