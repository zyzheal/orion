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

func initTables(db *sqlx.DB) error {
	// Create tables if they do not exist.
	queries := []string{
		`CREATE TABLE IF NOT EXISTS finops_costs (
			id SERIAL PRIMARY KEY,
			tenant_id VARCHAR(128) NOT NULL,
			entity_id VARCHAR(256) NOT NULL,
			entity_type VARCHAR(64) NOT NULL,
			cost DECIMAL(16,2) NOT NULL,
			currency VARCHAR(8) DEFAULT 'USD',
			category VARCHAR(128),
			provider VARCHAR(64),
			period_start VARCHAR(64),
			period_end VARCHAR(64),
			details TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS finops_budgets (
			id SERIAL PRIMARY KEY,
			tenant_id VARCHAR(128) NOT NULL,
			name VARCHAR(256) NOT NULL,
			entity_id VARCHAR(256) NOT NULL,
			entity_type VARCHAR(64) NOT NULL,
			amount DECIMAL(16,2) NOT NULL,
			period VARCHAR(64),
			currency VARCHAR(8) DEFAULT 'USD',
			category VARCHAR(128),
			alert_threshold DECIMAL(16,2),
			status VARCHAR(32) DEFAULT 'active',
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS finops_chargebacks (
			id SERIAL PRIMARY KEY,
			tenant_id VARCHAR(128) NOT NULL,
			entity_id VARCHAR(256) NOT NULL,
			entity_type VARCHAR(64) NOT NULL,
			allocated_cost DECIMAL(16,2) NOT NULL,
			percentage DECIMAL(5,2) NOT NULL,
			period VARCHAR(64),
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS finops_recommendations (
			id SERIAL PRIMARY KEY,
			tenant_id VARCHAR(128) NOT NULL,
			type VARCHAR(64) NOT NULL,
			title VARCHAR(256),
			description TEXT,
			estimated_savings DECIMAL(16,2),
			confidence DECIMAL(5,2),
			entity_id VARCHAR(256),
			entity_type VARCHAR(64),
			status VARCHAR(32) DEFAULT 'open',
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS finops_reports (
			id SERIAL PRIMARY KEY,
			tenant_id VARCHAR(128) NOT NULL,
			name VARCHAR(256) NOT NULL,
			type VARCHAR(64) NOT NULL,
			period VARCHAR(64),
			generated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS finops_roi (
			id SERIAL PRIMARY KEY,
			tenant_id VARCHAR(128) NOT NULL,
			period VARCHAR(64) NOT NULL,
			total_spend DECIMAL(16,2),
			total_savings DECIMAL(16,2),
			roi DECIMAL(10,4),
			implemented_actions INT DEFAULT 0,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS finops_collection_schedules (
			id SERIAL PRIMARY KEY,
			provider VARCHAR(64) UNIQUE NOT NULL,
			cron_expression VARCHAR(128) NOT NULL,
			enabled BOOLEAN DEFAULT true,
			last_run TIMESTAMPTZ
		)`,
		`CREATE TABLE IF NOT EXISTS finops_alert_triggers (
			id SERIAL PRIMARY KEY,
			budget_id INT NOT NULL,
			threshold DECIMAL(16,2) NOT NULL,
			triggered_at TIMESTAMPTZ DEFAULT NOW()
		)`,
	}
	for _, q := range queries {
		_, err := db.Exec(q)
		if err != nil {
			return fmt.Errorf("init table: %w", err)
		}
	}
	return nil
}

// --- Cost tracking ---

func (r *Repository) TrackCost(ctx context.Context, e *models.CostEntry) (int, error) {
	var id int
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO finops_costs (tenant_id, entity_id, entity_type, cost, currency, category, provider, period_start, period_end, details)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
		e.TenantID, e.EntityID, e.EntityType, e.Cost, e.Currency, e.Category, e.Provider, e.PeriodStart, e.PeriodEnd, "").Scan(&id)
	return id, err
}

func (r *Repository) GetCostByEntity(ctx context.Context, tenantID, entityType, entityID string) ([]models.CostEntry, error) {
	var items []models.CostEntry
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM finops_costs WHERE tenant_id=$1 AND entity_type=$2 AND entity_id=$3 ORDER BY period_start DESC`,
		tenantID, entityType, entityID)
	return items, err
}

func (r *Repository) GetEntityCostTrend(ctx context.Context, tenantID, entityType, entityID, period string) ([]models.CostTrendPoint, error) {
	var items []models.CostTrendPoint
	err := r.db.SelectContext(ctx, &items,
		`SELECT period_start AS period, cost FROM finops_costs WHERE tenant_id=$1 AND entity_type=$2 AND entity_id=$3 ORDER BY period_start`,
		tenantID, entityType, entityID)
	return items, err
}

func (r *Repository) GetCostSummary(ctx context.Context, tenantID, period string) (*models.CostSummary, error) {
	cs := &models.CostSummary{TenantID: tenantID, Period: period}
	err := r.db.GetContext(ctx, &cs.TotalCost,
		`SELECT COALESCE(SUM(cost), 0) FROM finops_costs WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	// Cost by category
	var catItems []models.CostBreakdownItem
	err = r.db.SelectContext(ctx, &catItems,
		`SELECT category AS key, SUM(cost) AS cost FROM finops_costs WHERE tenant_id=$1 GROUP BY category ORDER BY cost DESC`, tenantID)
	cs.CostByCategory = catItems

	// Cost by provider
	var provItems []models.CostBreakdownItem
	err = r.db.SelectContext(ctx, &provItems,
		`SELECT provider AS key, SUM(cost) AS cost FROM finops_costs WHERE tenant_id=$1 GROUP BY provider ORDER BY cost DESC`, tenantID)
	cs.CostByProvider = provItems

	// Forecast = total * 1.1 (simple 10% growth)
	cs.ForecastCost = cs.TotalCost * 1.1

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
		fmt.Sprintf(`SELECT %s AS key, SUM(cost) AS cost FROM finops_costs WHERE tenant_id=$1 GROUP BY %s ORDER BY cost DESC`, col, col),
		tenantID)
	return items, err
}

// --- Chargeback ---

func (r *Repository) GetChargebackReport(ctx context.Context, tenantID string) ([]models.ChargebackEntry, error) {
	var items []models.ChargebackEntry
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM finops_chargebacks WHERE tenant_id=$1 ORDER BY allocated_cost DESC`, tenantID)
	return items, err
}

func (r *Repository) CreateChargeback(ctx context.Context, e *models.ChargebackEntry) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO finops_chargebacks (tenant_id, entity_id, entity_type, allocated_cost, percentage, period)
		 VALUES (:tenant_id, :entity_id, :entity_type, :allocated_cost, :percentage, :period)`,
		e)
	return err
}

// --- Budget management ---

func (r *Repository) CreateBudget(ctx context.Context, budget *models.Budget) (int, error) {
	var id int
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO finops_budgets (tenant_id, name, entity_id, entity_type, amount, period, currency, category, alert_threshold, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
		budget.TenantID, budget.Name, budget.EntityID, budget.EntityType, budget.Amount,
		budget.Period, budget.Currency, budget.Category, budget.AlertThreshold, budget.Status).Scan(&id)
	return id, err
}

func (r *Repository) GetBudget(ctx context.Context, tenantID, id string) (*models.Budget, error) {
	var b models.Budget
	err := r.db.GetContext(ctx, &b,
		`SELECT * FROM finops_budgets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
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
		`SELECT * FROM finops_budgets WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return items, err
}

func (r *Repository) UpdateBudget(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if _, ok := updates["amount"]; ok {
		updates["status"] = "active"
	}
	updates["updated_at"] = time.Now().UTC()
	// Build SET clause dynamically from updates map.
	setParts := []string{}
	args := []interface{}{time.Now().UTC()}
	for _, k := range []string{"name", "amount", "period", "currency", "category", "alert_threshold", "status", "updated_at"} {
		if v, ok := updates[k]; ok {
			pos := len(args)
			args = append(args, v)
			setParts = append(setParts, fmt.Sprintf("%s=$%d", k, pos))
		}
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE finops_budgets SET %s WHERE id=$%d AND tenant_id=$%d`,
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
		`DELETE FROM finops_budgets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
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
		`SELECT COALESCE(SUM(cost),0) FROM finops_costs WHERE tenant_id=$1 AND entity_id=$2 AND entity_type=$3`,
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

func (r *Repository) ForecastBudget(ctx context.Context, tenantID, id string) (*models.BudgetForecastResponse, error) {
	b, err := r.GetBudget(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	var usedCost float64
	err = r.db.GetContext(ctx, &usedCost,
		`SELECT COALESCE(SUM(cost),0) FROM finops_costs WHERE tenant_id=$1 AND entity_id=$2 AND entity_type=$3`,
		tenantID, b.EntityID, b.EntityType)
	if err != nil {
		return nil, err
	}
	remainingDays := 30
	overrun := 0.0
	if usedCost > 0 && remainingDays > 0 {
		daily := usedCost / float64(remainingDays+1) // rough estimate
		projected := usedCost + daily*float64(remainingDays)
		overrun = ((projected - b.Amount) / b.Amount) * 100
	}
	return &models.BudgetForecastResponse{
		BudgetID:           b.ID,
		ProjectedTotalCost: usedCost * 1.2,
		RemainingDays:      remainingDays,
		OverrunLikelihood:  overrun,
		Recommendation:     "review spending",
	}, nil
}

// --- Budget alerts ---

func (r *Repository) CheckBudgetAlerts(ctx context.Context, tenantID string) ([]models.BudgetAlert, error) {
	var items []models.BudgetAlert
	err := r.db.SelectContext(ctx, &items,
		`SELECT b.id AS budget_id, b.name, b.alert_threshold AS threshold, 'warning' AS severity
		 FROM finops_budgets b
		 WHERE b.tenant_id=$1 AND b.status=$2
		 ORDER BY b.created_at DESC`,
		tenantID, "active")
	return items, err
}

func (r *Repository) GetAlertTriggers(ctx context.Context) ([]models.AlertTrigger, error) {
	var items []models.AlertTrigger
	err := r.db.SelectContext(ctx, &items,
		`SELECT a.id, a.budget_id, b.name, a.threshold, a.triggered_at
		 FROM finops_alert_triggers a
		 JOIN finops_budgets b ON b.id = a.budget_id
		 ORDER BY a.triggered_at DESC`)
	return items, err
}

// --- Recommendations ---

func (r *Repository) ListRecommendations(ctx context.Context, tenantID string, limit, offset int) ([]models.Recommendation, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Recommendation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM finops_recommendations WHERE tenant_id=$1 ORDER BY estimated_savings DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return items, err
}

func (r *Repository) GetRecommendation(ctx context.Context, tenantID string, id string) (*models.Recommendation, error) {
	var rec models.Recommendation
	err := r.db.GetContext(ctx, &rec,
		`SELECT * FROM finops_recommendations WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *Repository) CreateRecommendation(ctx context.Context, rec *models.Recommendation) (int, error) {
	var id int
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO finops_recommendations (tenant_id, type, title, description, estimated_savings, confidence, entity_id, entity_type, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
		rec.TenantID, rec.Type, rec.Title, rec.Description, rec.EstimatedSavings, rec.Confidence, rec.EntityID, rec.EntityType, rec.Status).Scan(&id)
	return id, err
}

func (r *Repository) UpdateRecommendationStatus(ctx context.Context, tenantID string, id string, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE finops_recommendations SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		status, id, tenantID)
	return err
}

func (r *Repository) DeleteRecommendation(ctx context.Context, tenantID string, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM finops_recommendations WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) GetRightSizingRecommendations(ctx context.Context, tenantID string) ([]models.Recommendation, error) {
	var items []models.Recommendation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM finops_recommendations WHERE tenant_id=$1 AND type=$2 ORDER BY estimated_savings DESC`,
		tenantID, "right-sizing")
	return items, err
}

func (r *Repository) DetectUnusedResources(ctx context.Context, tenantID string) ([]models.Recommendation, error) {
	var items []models.Recommendation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM finops_recommendations WHERE tenant_id=$1 AND type=$2 ORDER BY estimated_savings DESC`,
		tenantID, "unused")
	return items, err
}

func (r *Repository) EstimateSavings(ctx context.Context, tenantID string) (*models.SavingsEstimate, error) {
	var total float64
	err := r.db.GetContext(ctx, &total,
		`SELECT COALESCE(SUM(estimated_savings),0) FROM finops_recommendations WHERE tenant_id=$1 AND status=$2`,
		tenantID, "open")
	if err != nil {
		return nil, err
	}
	return &models.SavingsEstimate{
		TotalPotentialSavings:  total,
		OptimizationCategories: map[string]float64{},
		Confidence:             75.0,
		ReportedPeriod:         time.Now().UTC().Format(time.DateOnly),
	}, nil
}

// --- Reports ---

func (r *Repository) GetReportHistory(ctx context.Context, tenantID string) ([]models.Report, error) {
	var items []models.Report
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM finops_reports WHERE tenant_id=$1 ORDER BY generated_at DESC`, tenantID)
	return items, err
}

func (r *Repository) CreateReport(ctx context.Context, report *models.Report) (int, error) {
	var id int
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO finops_reports (tenant_id, name, type, period) VALUES ($1,$2,$3,$4) RETURNING id`,
		report.TenantID, report.Name, report.Type, report.Period).Scan(&id)
	return id, err
}

// --- ROI ---

func (r *Repository) GetROIHistory(ctx context.Context, tenantID string) ([]models.ROIEntry, error) {
	var items []models.ROIEntry
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM finops_roi WHERE tenant_id=$1 ORDER BY period DESC`, tenantID)
	return items, err
}

func (r *Repository) GetROISummary(ctx context.Context, tenantID string) (*models.ROISummary, error) {
	summary := &models.ROISummary{}
	err := r.db.GetContext(ctx, &summary.TotalSpend,
		`SELECT COALESCE(SUM(total_spend),0) FROM finops_roi WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	err = r.db.GetContext(ctx, &summary.TotalSavings,
		`SELECT COALESCE(SUM(total_savings),0) FROM finops_roi WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	err = r.db.GetContext(ctx, &summary.ImplementedActions,
		`SELECT COALESCE(SUM(implemented_actions),0) FROM finops_roi WHERE tenant_id=$1`, tenantID)
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
		`INSERT INTO finops_roi (tenant_id, period, total_spend, total_savings, roi, implemented_actions)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		e.TenantID, e.Period, e.TotalSpend, e.TotalSavings, e.ROI, e.ImplementedActions).Scan(&id)
	return id, err
}

// --- Collection schedules ---

func (r *Repository) GetRegisteredProviders(ctx context.Context) ([]string, error) {
	var providers []string
	err := r.db.SelectContext(ctx, &providers,
		`SELECT DISTINCT provider FROM finops_costs WHERE provider IS NOT NULL AND provider != ''`)
	return providers, err
}

func (r *Repository) SetSchedule(ctx context.Context, provider, cronExpression string, enabled bool) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO finops_collection_schedules (provider, cron_expression, enabled)
		 VALUES ($1,$2,$3)
		 ON CONFLICT (provider) DO UPDATE SET cron_expression=$2, enabled=$3`,
		provider, cronExpression, enabled)
	return err
}

func (r *Repository) GetSchedule(ctx context.Context, provider string) (*models.CollectionSchedule, error) {
	var s models.CollectionSchedule
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM finops_collection_schedules WHERE provider=$1`, provider)
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
	argIdx := 3

	if provider != "" {
		where += fmt.Sprintf(" AND provider=$%d", argIdx)
		args = append(args, provider)
	}

	var collected int
	err := r.db.GetContext(ctx, &collected,
		fmt.Sprintf("SELECT COUNT(*) FROM finops_costs WHERE %s", where), args...)
	if err != nil {
		return nil, err
	}

	var totalCost float64
	err = r.db.GetContext(ctx, &totalCost,
		fmt.Sprintf("SELECT COALESCE(SUM(cost), 0) FROM finops_costs WHERE %s", where), args...)
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
	var ok bool
	err := r.db.GetContext(ctx, &ok, `SELECT EXISTS(SELECT 1 FROM finops_costs LIMIT 1)`)
	return true, err
}

// HealthCheckAlways returns success without querying tables.
func (r *Repository) HealthCheckAlways(ctx context.Context) (bool, error) {
	return true, nil
}

// Sentinel error
func NotYetImplemented(msg string) error {
	return fmt.Errorf("%s", msg)
}
