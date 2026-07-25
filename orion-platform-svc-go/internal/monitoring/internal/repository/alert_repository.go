package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"orion/platform-svc-go/internal/monitoring/internal/models"
	"go.uber.org/zap"
)

type AlertRepository struct {
	db *DB
}

func NewAlertRepository(db *DB) *AlertRepository {
	return &AlertRepository{db: db}
}

func (r *AlertRepository) Query(ctx context.Context, tenantID uuid.UUID, req models.AlertQueryRequest) (models.AlertResponse, error) {
	var resp models.AlertResponse

	query := `SELECT id, tenant_id, rule_name, severity, status, description, triggered_at, resolved_at, created_at FROM alerts WHERE tenant_id = $1`
	countQuery := `SELECT COUNT(*) FROM alerts WHERE tenant_id = $1`
	args := []any{tenantID}
	argIdx := 2

	if req.Status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, req.Status)
		argIdx++
	}

	if req.Severity != "" {
		query += fmt.Sprintf(" AND severity = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND severity = $%d", argIdx)
		args = append(args, req.Severity)
		argIdx++
	}

	limit := req.Limit
	if limit <= 0 {
		limit = 50
	}
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, req.Offset)

	if err := r.db.Pool().QueryRow(ctx, countQuery, args[:len(args)-2]...).Scan(&resp.Total); err != nil {
		r.db.Logger().Error("failed to count alerts", zap.Error(err))
		return resp, fmt.Errorf("count alerts: %w", err)
	}

	rows, err := r.db.Pool().Query(ctx, query, args...)
	if err != nil {
		r.db.Logger().Error("failed to query alerts", zap.Error(err))
		return resp, fmt.Errorf("query alerts: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var a models.Alert
		if err := rows.Scan(&a.ID, &a.TenantID, &a.RuleName, &a.Severity, &a.Status, &a.Description, &a.TriggeredAt, &a.ResolvedAt, &a.CreatedAt); err != nil {
			r.db.Logger().Error("failed to scan alert", zap.Error(err))
			continue
		}
		resp.Data = append(resp.Data, a)
	}

	return resp, nil
}

func (r *AlertRepository) GetByID(ctx context.Context, tenantID, id uuid.UUID) (*models.Alert, error) {
	query := `SELECT id, tenant_id, rule_name, severity, status, description, triggered_at, resolved_at, created_at FROM alerts WHERE tenant_id = $1 AND id = $2`
	var a models.Alert
	err := r.db.Pool().QueryRow(ctx, query, tenantID, id).Scan(&a.ID, &a.TenantID, &a.RuleName, &a.Severity, &a.Status, &a.Description, &a.TriggeredAt, &a.ResolvedAt, &a.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get alert by ID: %w", err)
	}
	return &a, nil
}

func (r *AlertRepository) SilenceAlert(ctx context.Context, tenantID, id uuid.UUID) error {
	query := `UPDATE alerts SET status = 'silenced' WHERE tenant_id = $1 AND id = $2 AND status = 'firing'`
	tag, err := r.db.Pool().Exec(ctx, query, tenantID, id)
	if err != nil {
		return fmt.Errorf("silence alert: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("alert not found or not in firing state")
	}
	return nil
}

func (r *AlertRepository) ResolveAlert(ctx context.Context, tenantID, id uuid.UUID) error {
	now := time.Now()
	query := `UPDATE alerts SET status = 'resolved', resolved_at = $3 WHERE tenant_id = $1 AND id = $2 AND status IN ('firing', 'silenced')`
	tag, err := r.db.Pool().Exec(ctx, query, tenantID, id, now)
	if err != nil {
		return fmt.Errorf("resolve alert: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("alert not found or already resolved")
	}
	return nil
}

func (r *AlertRepository) CreateAlertRule(ctx context.Context, rule *models.AlertRule) error {
	query := `INSERT INTO alert_rules (id, tenant_id, name, metric_name, operator, threshold, evaluation_interval_sec, is_enabled, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
	now := time.Now()
	_, err := r.db.Pool().Exec(ctx, query, rule.ID, rule.TenantID, rule.Name, rule.MetricName, rule.Operator, rule.Threshold, rule.EvaluationIntervalSec, rule.IsEnabled, now, now)
	if err != nil {
		r.db.Logger().Error("failed to create alert rule", zap.String("name", rule.Name), zap.Error(err))
		return fmt.Errorf("create alert rule: %w", err)
	}
	return nil
}

func (r *AlertRepository) GetAlertRule(ctx context.Context, tenantID, id uuid.UUID) (*models.AlertRule, error) {
	query := `SELECT id, tenant_id, name, metric_name, operator, threshold, evaluation_interval_sec, is_enabled, created_at, updated_at FROM alert_rules WHERE tenant_id = $1 AND id = $2`
	var rule models.AlertRule
	err := r.db.Pool().QueryRow(ctx, query, tenantID, id).Scan(&rule.ID, &rule.TenantID, &rule.Name, &rule.MetricName, &rule.Operator, &rule.Threshold, &rule.EvaluationIntervalSec, &rule.IsEnabled, &rule.CreatedAt, &rule.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get alert rule: %w", err)
	}
	return &rule, nil
}

func (r *AlertRepository) QueryAlertRules(ctx context.Context, tenantID uuid.UUID) (models.AlertRuleResponse, error) {
	var resp models.AlertRuleResponse

	countQuery := `SELECT COUNT(*) FROM alert_rules WHERE tenant_id = $1`
	if err := r.db.Pool().QueryRow(ctx, countQuery, tenantID).Scan(&resp.Total); err != nil {
		r.db.Logger().Error("failed to count alert rules", zap.Error(err))
		return resp, fmt.Errorf("count alert rules: %w", err)
	}

	query := `SELECT id, tenant_id, name, metric_name, operator, threshold, evaluation_interval_sec, is_enabled, created_at, updated_at FROM alert_rules WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100 OFFSET 0`
	rows, err := r.db.Pool().Query(ctx, query, tenantID)
	if err != nil {
		r.db.Logger().Error("failed to query alert rules", zap.Error(err))
		return resp, fmt.Errorf("query alert rules: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var rule models.AlertRule
		if err := rows.Scan(&rule.ID, &rule.TenantID, &rule.Name, &rule.MetricName, &rule.Operator, &rule.Threshold, &rule.EvaluationIntervalSec, &rule.IsEnabled, &rule.CreatedAt, &rule.UpdatedAt); err != nil {
			r.db.Logger().Error("failed to scan alert rule", zap.Error(err))
			continue
		}
		resp.Data = append(resp.Data, rule)
	}

	return resp, nil
}

func (r *AlertRepository) UpdateAlertRule(ctx context.Context, tenantID, id uuid.UUID, req models.UpdateAlertRuleRequest) error {
	query := `UPDATE alert_rules SET updated_at = NOW()`
	args := []any{}
	argIdx := 3

	if req.Name != "" {
		query += fmt.Sprintf(", name = $%d", argIdx)
		args = append(args, req.Name)
		argIdx++
	}
	if req.MetricName != "" {
		query += fmt.Sprintf(", metric_name = $%d", argIdx)
		args = append(args, req.MetricName)
		argIdx++
	}
	if req.Operator != "" {
		query += fmt.Sprintf(", operator = $%d", argIdx)
		args = append(args, req.Operator)
		argIdx++
	}
	if req.Threshold != 0 {
		query += fmt.Sprintf(", threshold = $%d", argIdx)
		args = append(args, req.Threshold)
		argIdx++
	}
	if req.EvaluationIntervalSec > 0 {
		query += fmt.Sprintf(", evaluation_interval_sec = $%d", argIdx)
		args = append(args, req.EvaluationIntervalSec)
		argIdx++
	}
	if req.IsEnabled != nil {
		query += fmt.Sprintf(", is_enabled = $%d", argIdx)
		args = append(args, *req.IsEnabled)
		argIdx++
	}

	query += fmt.Sprintf(" WHERE tenant_id = $1 AND id = $2")
	args = append([]any{tenantID, id}, args...)

	tag, err := r.db.Pool().Exec(ctx, query, args...)
	if err != nil {
		r.db.Logger().Error("failed to update alert rule", zap.String("id", id.String()), zap.Error(err))
		return fmt.Errorf("update alert rule: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("alert rule not found")
	}
	return nil
}

func (r *AlertRepository) DeleteAlertRule(ctx context.Context, tenantID, id uuid.UUID) error {
	query := `DELETE FROM alert_rules WHERE tenant_id = $1 AND id = $2`
	tag, err := r.db.Pool().Exec(ctx, query, tenantID, id)
	if err != nil {
		r.db.Logger().Error("failed to delete alert rule", zap.String("id", id.String()), zap.Error(err))
		return fmt.Errorf("delete alert rule: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("alert rule not found")
	}
	return nil
}

func (r *AlertRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM alerts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *AlertRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM alerts WHERE tenant_id=$1`, tenantID)
	return count, err
}

// Pool returns the underlying pgx pool (used by AcknowledgeAlert).
func (r *AlertRepository) Pool() *pgxpool.Pool {
	return r.db.Pool()
}
