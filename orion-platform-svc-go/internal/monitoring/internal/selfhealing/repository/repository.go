package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/monitoring/internal/selfhealing/models"
	"go.uber.org/zap"
)

type SelfHealingRepository struct {
	db     *sql.DB
	logger *zap.Logger
}

func NewSelfHealingRepository(db *sql.DB, logger *zap.Logger) *SelfHealingRepository {
	return &SelfHealingRepository{db: db, logger: logger}
}

// CreateHealingAction creates a new healing action.
func (r *SelfHealingRepository) CreateHealingAction(ctx context.Context, tenantID uuid.UUID, req *models.CreateHealingActionRequest) (*models.HealingAction, error) {
	now := time.Now()
	isEnabled := true
	if req.IsEnabled != nil {
		isEnabled = *req.IsEnabled
	}
	id := uuid.New()

	query := `INSERT INTO healing_actions (id, tenant_id, name, description, action_type, target, command, is_enabled, retry_count, retry_delay, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`
	if _, err := r.db.ExecContext(ctx, query, id, tenantID, req.Name, req.Description, req.ActionType, req.Target, req.Command, isEnabled, req.RetryCount, req.RetryDelay, now, now); err != nil {
		return nil, fmt.Errorf("create healing action: %w", err)
	}

	action := &models.HealingAction{
		ID:          id,
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		ActionType:  req.ActionType,
		Target:      req.Target,
		Command:     req.Command,
		IsEnabled:   isEnabled,
		RetryCount:  req.RetryCount,
		RetryDelay:  req.RetryDelay,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	return action, nil
}

// QueryHealingActions returns paginated healing actions.
func (r *SelfHealingRepository) QueryHealingActions(ctx context.Context, tenantID uuid.UUID, limit, offset int) (models.HealingActionResponse, error) {
	var resp models.HealingActionResponse
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	countQuery := `SELECT COUNT(*) FROM healing_actions WHERE tenant_id = $1`
	query := `SELECT id, tenant_id, name, description, action_type, target, command, is_enabled, retry_count, retry_delay, created_at, updated_at FROM healing_actions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`

	if err := r.db.QueryRowContext(ctx, countQuery, tenantID).Scan(&resp.Total); err != nil {
		return resp, fmt.Errorf("count healing actions: %w", err)
	}

	rows, err := r.db.QueryContext(ctx, query, tenantID, limit, offset)
	if err != nil {
		return resp, fmt.Errorf("query healing actions: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var a models.HealingAction
		if err := rows.Scan(&a.ID, &a.TenantID, &a.Name, &a.Description, &a.ActionType, &a.Target, &a.Command, &a.IsEnabled, &a.RetryCount, &a.RetryDelay, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return resp, fmt.Errorf("scan healing action: %w", err)
		}
		resp.Data = append(resp.Data, a)
	}
	return resp, nil
}

// GetHealingAction returns a healing action by ID.
func (r *SelfHealingRepository) GetHealingAction(ctx context.Context, tenantID, id uuid.UUID) (*models.HealingAction, error) {
	var a models.HealingAction
	query := `SELECT id, tenant_id, name, description, action_type, target, command, is_enabled, retry_count, retry_delay, created_at, updated_at FROM healing_actions WHERE id = $1 AND tenant_id = $2`
	if err := r.db.QueryRowContext(ctx, query, id, tenantID).Scan(
		&a.ID, &a.TenantID, &a.Name, &a.Description, &a.ActionType, &a.Target, &a.Command, &a.IsEnabled, &a.RetryCount, &a.RetryDelay, &a.CreatedAt, &a.UpdatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("healing action not found: %s", id)
		}
		return nil, fmt.Errorf("get healing action: %w", err)
	}
	return &a, nil
}

// UpdateHealingAction updates a healing action.
func (r *SelfHealingRepository) UpdateHealingAction(ctx context.Context, tenantID, id uuid.UUID, name, description, command *string, isEnabled *bool) (*models.HealingAction, error) {
	action, err := r.GetHealingAction(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	if name != nil {
		action.Name = *name
	}
	if description != nil {
		action.Description = *description
	}
	if command != nil {
		action.Command = *command
	}
	if isEnabled != nil {
		action.IsEnabled = *isEnabled
	}
	action.UpdatedAt = time.Now()

	query := `UPDATE healing_actions SET name=$1, description=$2, command=$3, is_enabled=$4, updated_at=$5 WHERE id=$6`
	result, err := r.db.ExecContext(ctx, query, action.Name, action.Description, action.Command, action.IsEnabled, action.UpdatedAt, id)
	if err != nil {
		return nil, fmt.Errorf("update healing action: %w", err)
	}
	_ = result
	return action, nil
}

// ExecuteHealingAction records an execution attempt in history.
func (r *SelfHealingRepository) ExecuteHealingAction(ctx context.Context, tenantID, actionID uuid.UUID, triggerID *uuid.UUID, triggeredBy string) (*models.HealingHistory, error) {
	now := time.Now()
	id := uuid.New()

	triggerIDStr := "NULL"
	if triggerID != nil {
		triggerIDStr = triggerID.String()
	}

	query := fmt.Sprintf(`INSERT INTO healing_history (id, tenant_id, action_id, trigger_id, status, result, attempt, triggered_by, started_at, completed_at) VALUES ($1,$2,$3,%s,$5,$6,$7,$8,$9,$10)`, triggerIDStr)
	args := []any{id, tenantID, actionID, "running", "Executing...", 1, triggeredBy, now, nil}
	_ = args

	if _, err := r.db.ExecContext(ctx, query, id, tenantID, actionID, triggerID, "running", "Executing...", 1, triggeredBy, now, nil); err != nil {
		return nil, fmt.Errorf("execute healing action: %w", err)
	}

	history := &models.HealingHistory{
		ID:          id,
		TenantID:    tenantID,
		ActionID:    actionID,
		TriggerID:   triggerID,
		Status:      "running",
		Result:      "Executing...",
		Attempt:     1,
		TriggeredBy: triggeredBy,
		StartedAt:   now,
	}
	return history, nil
}

// UpdateHealingHistory updates the execution result.
func (r *SelfHealingRepository) UpdateHealingHistory(ctx context.Context, id uuid.UUID, status, result string, attempt int) error {
	now := time.Now()
	var completedAt interface{}
	if status == "completed" || status == "failed" {
		completedAt = now
	}

	query := `UPDATE healing_history SET status=$1, result=$2, attempt=$3, completed_at=$4 WHERE id=$5`
	_, err := r.db.ExecContext(ctx, query, status, result, attempt, completedAt, id)
	return err
}

// QueryHealingHistory returns paginated healing history.
func (r *SelfHealingRepository) QueryHealingHistory(ctx context.Context, tenantID uuid.UUID, actionID uuid.UUID, status string, limit, offset int) (models.HealingHistoryResponse, error) {
	var resp models.HealingHistoryResponse
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	where := []string{"tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2

	if actionID != uuid.Nil {
		where = append(where, fmt.Sprintf("action_id = $%d", argIdx))
		args = append(args, actionID)
		argIdx++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	whereClause := "WHERE " + joinStrings(where, " AND ")
	countArgs := make([]any, len(args))
	copy(countArgs, args)

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM healing_history %s`, whereClause)
	query := fmt.Sprintf(`
		SELECT id, tenant_id, action_id, trigger_id, status, result, attempt, triggered_by, started_at, completed_at
		FROM healing_history %s
		ORDER BY started_at DESC
		LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	if err := r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&resp.Total); err != nil {
		return resp, fmt.Errorf("count healing history: %w", err)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return resp, fmt.Errorf("query healing history: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var h models.HealingHistory
		var triggerID sql.NullString
		var completedAt sql.NullTime
		if err := rows.Scan(&h.ID, &h.TenantID, &h.ActionID, &triggerID, &h.Status, &h.Result, &h.Attempt, &h.TriggeredBy, &h.StartedAt, &completedAt); err != nil {
			return resp, fmt.Errorf("scan healing history: %w", err)
		}
		if triggerID.Valid {
			if u, err := uuid.Parse(triggerID.String); err == nil {
				h.TriggerID = &u
			}
		}
		if completedAt.Valid {
			h.CompletedAt = &completedAt.Time
		}
		resp.Data = append(resp.Data, h)
	}
	return resp, nil
}

// DeleteHealingAction removes a healing action.
func (r *SelfHealingRepository) DeleteHealingAction(ctx context.Context, tenantID, id uuid.UUID) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM healing_actions WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete healing action: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("healing action not found: %s", id)
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
