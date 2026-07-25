package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/monitoring/internal/alert-correlation/models"
	"go.uber.org/zap"
)

type AlertCorrelationRepository struct {
	db     *sql.DB
	logger *zap.Logger
}

func NewAlertCorrelationRepository(db *sql.DB, logger *zap.Logger) *AlertCorrelationRepository {
	return &AlertCorrelationRepository{db: db, logger: logger}
}

// CreateGroup creates a correlation group.
func (r *AlertCorrelationRepository) CreateGroup(ctx context.Context, tenantID, rootAlertID uuid.UUID, alertIDs []uuid.UUID, groupType string) (*models.CorrelationGroup, error) {
	now := time.Now()
	id := uuid.New()

	alertIDsJSON, _ := json.Marshal(alertIDs)
	query := `INSERT INTO correlation_groups (id, tenant_id, root_alert_id, alert_ids, group_type, confidence, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`
	if _, err := r.db.ExecContext(ctx, query, id, tenantID, rootAlertID, string(alertIDsJSON), groupType, 0.0, now, now); err != nil {
		return nil, fmt.Errorf("create correlation group: %w", err)
	}

	group := &models.CorrelationGroup{
		ID:          id,
		TenantID:    tenantID,
		RootAlertID: rootAlertID,
		AlertIDs:    alertIDs,
		GroupType:   groupType,
		Confidence:  0.0,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	return group, nil
}

// QueryGroups returns paginated correlation groups.
func (r *AlertCorrelationRepository) QueryGroups(ctx context.Context, tenantID uuid.UUID, groupType string, limit, offset int) (models.CorrelationResult, error) {
	var resp models.CorrelationResult
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	where := []string{"tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2

	if groupType != "" {
		where = append(where, fmt.Sprintf("group_type = $%d", argIdx))
		args = append(args, groupType)
		argIdx++
	}

	whereClause := "WHERE " + joinStrings(where, " AND ")
	countArgs := make([]any, len(args))
	copy(countArgs, args)

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM correlation_groups %s`, whereClause)
	query := fmt.Sprintf(`
		SELECT id, tenant_id, root_alert_id, alert_ids, group_type, confidence, created_at, updated_at
		FROM correlation_groups %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	if err := r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&resp.Total); err != nil {
		return resp, fmt.Errorf("count correlation groups: %w", err)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return resp, fmt.Errorf("query correlation groups: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var g models.CorrelationGroup
		var alertIDsJSON sql.NullString
		if err := rows.Scan(&g.ID, &g.TenantID, &g.RootAlertID, &alertIDsJSON, &g.GroupType, &g.Confidence, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return resp, fmt.Errorf("scan correlation group: %w", err)
		}
		if alertIDsJSON.Valid {
			_ = json.Unmarshal([]byte(alertIDsJSON.String), &g.AlertIDs)
		}
		resp.Groups = append(resp.Groups, g)
	}
	return resp, nil
}

// GetGroup returns a correlation group by ID.
func (r *AlertCorrelationRepository) GetGroup(ctx context.Context, tenantID, id uuid.UUID) (*models.CorrelationGroup, error) {
	var g models.CorrelationGroup
	var alertIDsJSON sql.NullString

	query := `SELECT id, tenant_id, root_alert_id, alert_ids, group_type, confidence, created_at, updated_at FROM correlation_groups WHERE id = $1 AND tenant_id = $2`
	if err := r.db.QueryRowContext(ctx, query, id, tenantID).Scan(
		&g.ID, &g.TenantID, &g.RootAlertID, &alertIDsJSON, &g.GroupType, &g.Confidence, &g.CreatedAt, &g.UpdatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("correlation group not found: %s", id)
		}
		return nil, fmt.Errorf("get correlation group: %w", err)
	}
	if alertIDsJSON.Valid {
		_ = json.Unmarshal([]byte(alertIDsJSON.String), &g.AlertIDs)
	}
	return &g, nil
}

// CreateRule creates a correlation rule.
func (r *AlertCorrelationRepository) CreateRule(ctx context.Context, tenantID uuid.UUID, name, description, groupType string, timeWindowSec int, conditions string) (*models.CorrelationRule, error) {
	now := time.Now()
	id := uuid.New()

	query := `INSERT INTO correlation_rules (id, tenant_id, name, description, group_type, time_window_sec, is_enabled, conditions, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`
	if _, err := r.db.ExecContext(ctx, query, id, tenantID, name, description, groupType, timeWindowSec, true, conditions, now); err != nil {
		return nil, fmt.Errorf("create correlation rule: %w", err)
	}

	return &models.CorrelationRule{
		ID:            id,
		TenantID:      tenantID,
		Name:          name,
		Description:   description,
		GroupType:     groupType,
		TimeWindowSec: timeWindowSec,
		IsEnabled:     true,
		Conditions:    conditions,
		CreatedAt:     now,
	}, nil
}

// QueryRules returns paginated correlation rules.
func (r *AlertCorrelationRepository) QueryRules(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.CorrelationRule, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var total int64
	countQuery := `SELECT COUNT(*) FROM correlation_rules WHERE tenant_id = $1`
	if err := r.db.QueryRowContext(ctx, countQuery, tenantID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count correlation rules: %w", err)
	}

	query := `SELECT id, tenant_id, name, description, group_type, time_window_sec, is_enabled, conditions, created_at FROM correlation_rules WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := r.db.QueryContext(ctx, query, tenantID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query correlation rules: %w", err)
	}
	defer rows.Close()

	var rules []models.CorrelationRule
	for rows.Next() {
		var r models.CorrelationRule
		if err := rows.Scan(&r.ID, &r.TenantID, &r.Name, &r.Description, &r.GroupType, &r.TimeWindowSec, &r.IsEnabled, &r.Conditions, &r.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan correlation rule: %w", err)
		}
		rules = append(rules, r)
	}
	return rules, total, nil
}

// DeleteGroup removes a correlation group.
func (r *AlertCorrelationRepository) DeleteGroup(ctx context.Context, tenantID, id uuid.UUID) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM correlation_groups WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete correlation group: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("correlation group not found: %s", id)
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
