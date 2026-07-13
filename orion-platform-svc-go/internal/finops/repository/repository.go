package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/finops/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("not found")

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
	if guard.Enabled == false {
		// keep false; default true
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
	}
	var anomalies []models.Anomaly
	err := r.db.SelectContext(ctx, &anomalies,
		fmt.Sprintf(`SELECT * FROM finops_anomalies %s ORDER BY detected_at DESC`, where), args...)
	return anomalies, err
}

func (r *Repository) CreateAnomaly(ctx context.Context, anomaly *models.Anomaly) error {
	anomaly.ID = uuid.New().String()
	anomaly.DetectedAt = time.Now().UTC()
	anomaly.CreatedAt = anomaly.DetectedAt
	if anomaly.Details == "" {
		anomaly.Details = "{}"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO finops_anomalies (id, tenant_id, type, severity, detected_at, resolved_at, details, created_at)
		 VALUES (:id, :tenantId, :type, :severity, :detectedAt, :resolvedAt, :details, :createdAt)`,
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

// --- Helpers ---

func buildUpdateSet(updates map[string]interface{}) (string, []interface{}, error) {
	if len(updates) == 0 {
		return "", nil, ErrNotFound
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
