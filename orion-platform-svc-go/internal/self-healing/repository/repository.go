package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/self-healing/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// jsonb marshals a value to JSON string, returning "{}" on failure.
func jsonb(v any) string {
	if v == nil {
		return "{}"
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// === Strategies ===

func (r *Repository) CreateStrategy(ctx context.Context, s *models.HealingStrategy) error {
	now := time.Now().UTC()
	s.CreatedAt = now
	s.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO self_healing_strategies
			(id, name, trigger_type, actions, conditions, confidence, enabled, description,
			 environments, max_retries, retry_cooldown_ms, created_at, updated_at)
		VALUES (:id, :name, :triggerType, :actions, :conditions, :confidence, :enabled, :description,
			:environments, :maxRetries, :retryCooldownMs, :createdAt, :updatedAt)
	`, s)
	return err
}

func (r *Repository) GetStrategy(ctx context.Context, id string) (*models.HealingStrategy, error) {
	var s models.HealingStrategy
	err := r.db.GetContext(ctx, &s, `SELECT * FROM self_healing_strategies WHERE id=$1`, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &s, nil
}

func (r *Repository) ListStrategies(ctx context.Context) ([]models.HealingStrategy, error) {
	var strategies []models.HealingStrategy
	err := r.db.SelectContext(ctx, &strategies, `SELECT * FROM self_healing_strategies ORDER BY name`)
	return strategies, err
}

func (r *Repository) ToggleStrategy(ctx context.Context, id string, enabled bool) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE self_healing_strategies SET enabled=$1, updated_at=$2 WHERE id=$3`,
		enabled, time.Now().UTC(), id)
	return err
}

// === Incidents ===

func (r *Repository) CreateIncident(ctx context.Context, tenantID string, req models.CreateIncidentRequest) (*models.HealingIncident, error) {
	now := time.Now().UTC()
	tagsJSON := "{}"
	if len(req.Tags) > 0 {
		b, err := json.Marshal(req.Tags)
		if err != nil {
			return nil, err
		}
		tagsJSON = string(b)
	}

	incident := &models.HealingIncident{
		ID:                uuid.New().String(),
		TenantID:          tenantID,
		AlertID:           req.AlertID,
		Type:              req.Type,
		Severity:          req.Severity,
		AppName:           req.AppName,
		Environment:       req.Environment,
		Status:            models.IncidentStatusEvaluating,
		ApprovalStatus:    "not_required",
		Actions:           "{}",
		Tags:              tagsJSON,
		CreatedAt:         now,
		StartedAt:         now,
		Attempts:          0,
		StrategyID:        "",
		StrategyName:      "",
		Result:            "",
		Error:             "",
		ApprovalRequestID: "",
	}

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO self_healing_incidents
			(id, tenant_id, alert_id, type, severity, app_name, environment, strategy_id,
			 strategy_name, actions, status, attempts, approval_status, approval_request_id,
			 result, error, tags, created_at, started_at)
		VALUES (:id, :tenantId, :alertId, :type, :severity, :appName, :environment, :strategyId,
			:strategyName, :actions, :status, :attempts, :approvalStatus, :approvalRequestId,
			:result, :error, :tags, :createdAt, :startedAt)
	`, incident)
	return incident, err
}

func (r *Repository) GetIncident(ctx context.Context, tenantID, id string) (*models.HealingIncident, error) {
	var i models.HealingIncident
	err := r.db.GetContext(ctx, &i, `SELECT * FROM self_healing_incidents WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &i, nil
}

func (r *Repository) UpdateIncident(ctx context.Context, id string, updates map[string]interface{}) (*models.HealingIncident, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}

	setParts := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+1)
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, k+" = $"+fmt.Sprint(idx))
		args = append(args, v)
		idx++
	}
	args = append(args, id)

	query := "UPDATE self_healing_incidents SET " + strings.Join(setParts, ", ") + " WHERE id = $" + fmt.Sprint(idx) + " RETURNING *"
	var i models.HealingIncident
	err := r.db.GetContext(ctx, &i, query, args...)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &i, nil
}

// ListIncidents returns paginated incidents with optional filters.
func (r *Repository) ListIncidents(ctx context.Context, tenantID string, q models.HistoryQuery) ([]models.HealingIncident, int, error) {
	limit := q.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	page := q.Page
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	whereParts := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if q.AppName != "" {
		whereParts = append(whereParts, fmt.Sprintf("app_name = $%d", argIdx))
		args = append(args, q.AppName)
		argIdx++
	}
	if q.Environment != "" {
		whereParts = append(whereParts, fmt.Sprintf("environment = $%d", argIdx))
		args = append(args, q.Environment)
		argIdx++
	}
	if q.Type != "" {
		whereParts = append(whereParts, fmt.Sprintf("type = $%d", argIdx))
		args = append(args, q.Type)
		argIdx++
	}
	if q.Status != "" {
		whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
		_ = argIdx
		args = append(args, q.Status)
		argIdx++
	}
	if q.Severity != "" {
		whereParts = append(whereParts, fmt.Sprintf("severity = $%d", argIdx))
		args = append(args, q.Severity)
		argIdx++
	}

	whereClause := strings.Join(whereParts, " AND ")

	countSQL := "SELECT COUNT(*) FROM self_healing_incidents WHERE " + whereClause
	var total int
	if err := r.db.GetContext(ctx, &total, countSQL, args...); err != nil {
		return nil, 0, err
	}

	dataSQL := fmt.Sprintf("SELECT * FROM self_healing_incidents WHERE %s ORDER BY started_at DESC LIMIT $%d OFFSET $%d",
		whereClause, argIdx, argIdx+1)
	dataArgs := append(args, limit, offset)

	var incidents []models.HealingIncident
	if err := r.db.SelectContext(ctx, &incidents, dataSQL, dataArgs...); err != nil {
		return nil, 0, err
	}
	return incidents, total, nil
}

// CountForEffectiveness counts incidents matching filters (no pagination).
func (r *Repository) CountForEffectiveness(ctx context.Context, tenantID string, q models.EffectivenessQuery) (int, error) {
	whereParts := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if q.AppName != "" {
		whereParts = append(whereParts, fmt.Sprintf("app_name = $%d", argIdx))
		args = append(args, q.AppName)
		argIdx++
	}
	if q.Environment != "" {
		whereParts = append(whereParts, fmt.Sprintf("environment = $%d", argIdx))
		args = append(args, q.Environment)
		argIdx++
	}

	var total int
	err := r.db.GetContext(ctx, &total,
		"SELECT COUNT(*) FROM self_healing_incidents WHERE "+strings.Join(whereParts, " AND "), args...)
	return total, err
}

// ListForEffectiveness returns all matching incidents (large limit for metrics).
func (r *Repository) ListForEffectiveness(ctx context.Context, tenantID string, q models.EffectivenessQuery) ([]models.HealingIncident, error) {
	whereParts := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if q.AppName != "" {
		whereParts = append(whereParts, fmt.Sprintf("app_name = $%d", argIdx))
		_ = argIdx
		args = append(args, q.AppName)
		argIdx++
	}
	if q.Environment != "" {
		whereParts = append(whereParts, fmt.Sprintf("environment = $%d", argIdx))
		_ = argIdx
		args = append(args, q.Environment)
		argIdx++
	}

	var incidents []models.HealingIncident
	err := r.db.SelectContext(ctx, &incidents,
		"SELECT * FROM self_healing_incidents WHERE "+strings.Join(whereParts, " AND ")+" ORDER BY started_at DESC LIMIT 10000", args...)
	return incidents, err
}

// === Approvals ===

func (r *Repository) CreateApprovalRequest(ctx context.Context, incidentID, title string, req models.RespondApprovalRequest, riskLevel string, actions []models.HealingAction, expiresAt *time.Time) (*models.ApprovalRequest, error) {
	now := time.Now().UTC()
	actionsJSON := "{}"
	if len(actions) > 0 {
		b, err := json.Marshal(actions)
		if err != nil {
			return nil, err
		}
		actionsJSON = string(b)
	}

	a := &models.ApprovalRequest{
		ID:                 uuid.New().String(),
		IncidentID:         incidentID,
		Title:              title,
		Description:        "",
		RiskLevel:          models.RiskLevel(riskLevel),
		RecommendedActions: actionsJSON,
		Status:             "pending",
		RequestedBy:        req.RespondedBy,
		RequestedAt:        now,
		ExpiresAt:          expiresAt,
	}

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO self_healing_approvals
			(id, incident_id, title, description, risk_level, recommended_actions, status,
			 requested_by, requested_at, expires_at)
		VALUES (:id, :incidentId, :title, :description, :riskLevel, :recommendedActions, :status,
			:requestedBy, :requestedAt, :expiresAt)
	`, a)
	return a, err
}

func (r *Repository) GetApprovalRequest(ctx context.Context, id string) (*models.ApprovalRequest, error) {
	var a models.ApprovalRequest
	err := r.db.GetContext(ctx, &a, `SELECT * FROM self_healing_approvals WHERE id=$1`, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &a, nil
}

func (r *Repository) ListApprovalRequests(ctx context.Context, status string) ([]models.ApprovalRequest, error) {
	if status != "" {
		var approvals []models.ApprovalRequest
		err := r.db.SelectContext(ctx, &approvals,
			`SELECT * FROM self_healing_approvals WHERE status=$1 ORDER BY requested_at DESC`, status)
		return approvals, err
	}
	var approvals []models.ApprovalRequest
	err := r.db.SelectContext(ctx, &approvals, `SELECT * FROM self_healing_approvals ORDER BY requested_at DESC`)
	return approvals, err
}

func (r *Repository) UpdateApprovalRequest(ctx context.Context, id string, updates map[string]interface{}) (*models.ApprovalRequest, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}

	setParts := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+1)
	idx := 1
	for k, v := range updates {
		setParts = append(setParts, k+" = $"+fmt.Sprint(idx))
		args = append(args, v)
		idx++
	}
	args = append(args, id)

	query := "UPDATE self_healing_approvals SET " + strings.Join(setParts, ", ") + " WHERE id = $" + fmt.Sprint(idx) + " RETURNING *"
	var a models.ApprovalRequest
	err := r.db.GetContext(ctx, &a, query, args...)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &a, nil
}

func (r *Repository) MarkExpiredApprovals(ctx context.Context) (int64, error) {
	result, err := r.db.ExecContext(ctx, `
		UPDATE self_healing_approvals
		SET status = 'expired'
		WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < NOW()
	`)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// GetIncidentByApprovalID fetches the incident linked to an approval request.
func (r *Repository) GetIncidentByApprovalID(ctx context.Context, tenantID, approvalID string) (*models.HealingIncident, error) {
	var i models.HealingIncident
	err := r.db.GetContext(ctx, &i, `
		SELECT si.* FROM self_healing_incidents si
		JOIN self_healing_approvals sa ON si.id = sa.incident_id
		WHERE sa.id = $1 AND si.tenant_id = $2
	`, approvalID, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &i, nil
}
