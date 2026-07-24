package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/auto-recovery/models"
)

type AutoRecoveryRepository struct {
	DB *sql.DB
}

func NewAutoRecoveryRepository(db *sql.DB) *AutoRecoveryRepository {
	return &AutoRecoveryRepository{DB: db}
}

// CreateRule creates a new auto-recovery rule.
func (r *AutoRecoveryRepository) CreateRule(ctx context.Context, tenantID string, req *models.CreateRuleRequest) (*models.AutoRecoveryRule, error) {
	id := fmt.Sprintf("rule_%d", time.Now().UnixNano())
	isEnabled := true
	if req.IsEnabled != nil {
		isEnabled = *req.IsEnabled
	}
	maxRetries := req.MaxRetries
	now := time.Now()
	if maxRetries <= 0 {
		maxRetries = 3
	}

	query := `INSERT INTO auto_recovery_rules (id, tenant_id, name, description, trigger, condition, action, target, is_enabled, max_retries, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`
	if _, err := r.DB.ExecContext(ctx, query, id, tenantID, req.Name, req.Description, req.Trigger, req.Condition, req.Action, req.Target, isEnabled, maxRetries, now); err != nil {
		return nil, fmt.Errorf("create auto-recovery rule: %w", err)
	}

	return &models.AutoRecoveryRule{
		ID:          id,
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Trigger:     req.Trigger,
		Condition:   req.Condition,
		Action:      req.Action,
		Target:      req.Target,
		IsEnabled:   isEnabled,
		MaxRetries:  maxRetries,
		CreatedAt:   now,
	}, nil
}

// QueryRules returns paginated rules.
func (r *AutoRecoveryRepository) QueryRules(ctx context.Context, tenantID string, limit, offset int) (models.RuleResponse, error) {
	var resp models.RuleResponse
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	countQuery := `SELECT COUNT(*) FROM auto_recovery_rules WHERE tenant_id = $1`
	query := `SELECT id, tenant_id, name, description, trigger, condition, action, target, is_enabled, max_retries, created_at FROM auto_recovery_rules WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`

	if err := r.DB.QueryRowContext(ctx, countQuery, tenantID).Scan(&resp.Total); err != nil {
		return resp, fmt.Errorf("count auto-recovery rules: %w", err)
	}

	rows, err := r.DB.QueryContext(ctx, query, tenantID, limit, offset)
	if err != nil {
		return resp, fmt.Errorf("query auto-recovery rules: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var r models.AutoRecoveryRule
		if err := rows.Scan(&r.ID, &r.TenantID, &r.Name, &r.Description, &r.Trigger, &r.Condition, &r.Action, &r.Target, &r.IsEnabled, &r.MaxRetries, &r.CreatedAt); err != nil {
			return resp, fmt.Errorf("scan rule: %w", err)
		}
		resp.Data = append(resp.Data, r)
	}
	return resp, nil
}

// GetRule returns a rule by ID.
func (r *AutoRecoveryRepository) GetRule(ctx context.Context, tenantID, id string) (*models.AutoRecoveryRule, error) {
	var rule models.AutoRecoveryRule
	query := `SELECT id, tenant_id, name, description, trigger, condition, action, target, is_enabled, max_retries, created_at FROM auto_recovery_rules WHERE id = $1 AND tenant_id = $2`
	if err := r.DB.QueryRowContext(ctx, query, id, tenantID).Scan(
		&rule.ID, &rule.TenantID, &rule.Name, &rule.Description, &rule.Trigger, &rule.Condition, &rule.Action, &rule.Target, &rule.IsEnabled, &rule.MaxRetries, &rule.CreatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("rule not found: %s", id)
		}
		return nil, fmt.Errorf("get rule: %w", err)
	}
	return &rule, nil
}

// CreateAction records a recovery action.
func (r *AutoRecoveryRepository) CreateAction(ctx context.Context, ruleID, tenantID, action, target string) (*models.RecoveryAction, error) {
	id := fmt.Sprintf("action_%d", time.Now().UnixNano())
tnow := time.Now()
	query := `INSERT INTO recovery_actions (id, rule_id, tenant_id, action, target, status, result, retry_count, created_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`
	if _, err := r.DB.ExecContext(ctx, query, id, ruleID, tenantID, action, target, "pending", "", 0, now, nil); err != nil {
		return nil, fmt.Errorf("create recovery action: %w", err)
	}

	return &models.RecoveryAction{
		ID:        id,
		RuleID:    ruleID,
		TenantID:  tenantID,
		Action:    action,
		Target:    target,
		Status:    "pending",
		CreatedAt: now,
	}, nil
}

// UpdateAction updates a recovery action.
func (r *AutoRecoveryRepository) UpdateAction(ctx context.Context, id string, status, result string, retryCount int) error {
	now := time.Time{}
	var completedAt interface{}
	if status == "succeeded" || status == "failed" {
		completedAt = time.Now()
		now = completedAt.(time.Time)
	}

	query := `UPDATE recovery_actions SET status=$1, result=$2, retry_count=$3, completed_at=$4 WHERE id=$5`
	_, err := r.DB.ExecContext(ctx, query, status, result, retryCount, completedAt, id)
	return err
}

// QueryActions returns paginated actions.
func (r *AutoRecoveryRepository) QueryActions(ctx context.Context, tenantID string, ruleID, status string, limit, offset int) (models.ActionResponse, error) {
	var resp models.ActionResponse
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	where := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if ruleID != "" {
		where = append(where, fmt.Sprintf("rule_id = $%d", argIdx))
		args = append(args, ruleID)
		argIdx++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	whereClause := "WHERE " + joinStrings(where, " AND ")
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM recovery_actions %s`, whereClause)
	query := fmt.Sprintf(`
		SELECT id, rule_id, tenant_id, action, target, status, result, retry_count, created_at, completed_at
		FROM recovery_actions %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	if err := r.DB.QueryRowContext(ctx, countQuery, countArgs...).Scan(&resp.Total); err != nil {
		return resp, fmt.Errorf("count recovery actions: %w", err)
	}

	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return resp, fmt.Errorf("query recovery actions: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var a models.RecoveryAction
		var completedAt sql.NullTime
		if err := rows.Scan(&a.ID, &a.RuleID, &a.TenantID, &a.Action, &a.Target, &a.Status, &a.Result, &a.RetryCount, &a.CreatedAt, &completedAt); err != nil {
			return resp, fmt.Errorf("scan action: %w", err)
		}
		if completedAt.Valid {
			a.CompletedAt = &completedAt.Time
		}
		resp.Data = append(resp.Data, a)
	}
	return resp, nil
}

// DeleteRule removes a rule.
func (r *AutoRecoveryRepository) DeleteRule(ctx context.Context, tenantID, id string) error {
	result, err := r.DB.ExecContext(ctx, `DELETE FROM auto_recovery_rules WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete rule: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("rule not found: %s", id)
	}
	return nil
}

func joinStrings(items []string, sep string) string {
	result := ""
	for i, item := range items {
		if i > 0 {
			result += sep
		}
		result += item
	}
	return result
}
