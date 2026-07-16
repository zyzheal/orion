package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"orion/monitor-svc-go/internal/models"
	"go.uber.org/zap"
)

// EscalationPolicyRepository manages escalation policies.
type EscalationPolicyRepository struct {
	db *DB
}

func NewEscalationPolicyRepository(db *DB) *EscalationPolicyRepository {
	return &EscalationPolicyRepository{db: db}
}

func (r *EscalationPolicyRepository) CreatePolicy(ctx context.Context, p *models.EscalationPolicy) error {
	now := time.Now()
	query := `INSERT INTO escalation_policies (id, tenant_id, name, steps, repeat_count, is_enabled, description, created_at, updated_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
	_, err := r.db.Pool().Exec(ctx, query,
		p.ID, p.TenantID, p.Name, p.Steps, p.RepeatCount, p.IsEnabled, p.Description, now, now,
	)
	if err != nil {
		r.db.Logger().Error("failed to create escalation policy",
			zap.String("name", p.Name),
			zap.Error(err),
		)
		return fmt.Errorf("create escalation policy: %w", err)
	}
	return nil
}

func (r *EscalationPolicyRepository) GetByID(ctx context.Context, tenantID, id uuid.UUID) (*models.EscalationPolicy, error) {
	query := `SELECT id, tenant_id, name, steps, repeat_count, is_enabled, description, created_at, updated_at
	FROM escalation_policies WHERE tenant_id = $1 AND id = $2`
	var p models.EscalationPolicy
	err := r.db.Pool().QueryRow(ctx, query, tenantID, id).Scan(
		&p.ID, &p.TenantID, &p.Name, &p.Steps, &p.RepeatCount, &p.IsEnabled, &p.Description, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get escalation policy: %w", err)
	}
	return &p, nil
}

func (r *EscalationPolicyRepository) ListPolicies(ctx context.Context, tenantID uuid.UUID) (models.EscalationPolicyResponse, error) {
	var resp models.EscalationPolicyResponse

	countQuery := `SELECT COUNT(*) FROM escalation_policies WHERE tenant_id = $1`
	if err := r.db.Pool().QueryRow(ctx, countQuery, tenantID).Scan(&resp.Total); err != nil {
		r.db.Logger().Error("failed to count escalation policies", zap.Error(err))
		return resp, fmt.Errorf("count escalation policies: %w", err)
	}

	query := `SELECT id, tenant_id, name, steps, repeat_count, is_enabled, description, created_at, updated_at
	FROM escalation_policies WHERE tenant_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Pool().Query(ctx, query, tenantID)
	if err != nil {
		r.db.Logger().Error("failed to query escalation policies", zap.Error(err))
		return resp, fmt.Errorf("query escalation policies: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var p models.EscalationPolicy
		if err := rows.Scan(&p.ID, &p.TenantID, &p.Name, &p.Steps, &p.RepeatCount, &p.IsEnabled, &p.Description, &p.CreatedAt, &p.UpdatedAt); err != nil {
			continue
		}
		resp.Data = append(resp.Data, p)
	}
	return resp, nil
}

// GetStep retrieves an escalation step by step number.
func GetStep(stepsJSON json.RawMessage, step int) map[string]interface{} {
	var steps []map[string]interface{}
	if err := json.Unmarshal(stepsJSON, &steps); err != nil {
		return nil
	}
	if step < 0 || step >= len(steps) {
		return nil
	}
	return steps[step]
}

// ==================== NotificationHistoryRepository ====================

// NotificationHistoryRepository manages notification delivery history.
type NotificationHistoryRepository struct {
	db *DB
}

func NewNotificationHistoryRepository(db *DB) *NotificationHistoryRepository {
	return &NotificationHistoryRepository{db: db}
}

func (r *NotificationHistoryRepository) Create(ctx context.Context, h *models.NotificationHistory) error {
	now := time.Now()
	query := `INSERT INTO notification_history (id, tenant_id, alert_id, channel_id, channel_type, status, sent_at, error_message, response_payload, escalation_step, created_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
	_, err := r.db.Pool().Exec(ctx, query,
		h.ID, h.TenantID, h.AlertID, h.ChannelID, h.ChannelType, h.Status, now, h.ErrorMessage, h.ResponsePayload, h.EscalationStep, now,
	)
	if err != nil {
		r.db.Logger().Error("failed to create notification history",
			zap.Error(err),
		)
		return fmt.Errorf("create notification history: %w", err)
	}
	return nil
}

func (r *NotificationHistoryRepository) List(ctx context.Context, tenantID uuid.UUID, req models.NotificationHistoryQueryRequest) (models.NotificationHistoryResponse, error) {
	var resp models.NotificationHistoryResponse

	base := `SELECT id, tenant_id, alert_id, channel_id, channel_type, status, sent_at, error_message, response_payload, escalation_step, created_at FROM notification_history WHERE tenant_id = $1`
	countBase := `SELECT COUNT(*) FROM notification_history WHERE tenant_id = $1`
	args := []any{tenantID}
	argIdx := 2

	if req.AlertID != nil {
		base += fmt.Sprintf(" AND alert_id = $%d", argIdx)
		countBase += fmt.Sprintf(" AND alert_id = $%d", argIdx)
		args = append(args, *req.AlertID)
		argIdx++
	}
	if req.ChannelID != nil {
		base += fmt.Sprintf(" AND channel_id = $%d", argIdx)
		countBase += fmt.Sprintf(" AND channel_id = $%d", argIdx)
		args = append(args, *req.ChannelID)
		argIdx++
	}
	if req.Status != "" {
		cond := fmt.Sprintf(" AND status = $%d", argIdx)
		base += cond
		countBase += cond
		args = append(args, req.Status)
		argIdx++
	}

	limit := req.Limit
	if limit <= 0 {
		limit = 50
	}
	base += fmt.Sprintf(" ORDER BY sent_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, req.Offset)

	if err := r.db.Pool().QueryRow(ctx, countBase, args[:len(args)-2]...).Scan(&resp.Total); err != nil {
		r.db.Logger().Error("failed to count notification history", zap.Error(err))
		return resp, fmt.Errorf("count notification history: %w", err)
	}

	rows, err := r.db.Pool().Query(ctx, base, args...)
	if err != nil {
		r.db.Logger().Error("failed to query notification history", zap.Error(err))
		return resp, fmt.Errorf("query notification history: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var h models.NotificationHistory
		if err := rows.Scan(&h.ID, &h.TenantID, &h.AlertID, &h.ChannelID, &h.ChannelType, &h.Status, &h.SentAt, &h.ErrorMessage, &h.ResponsePayload, &h.EscalationStep, &h.CreatedAt); err != nil {
			continue
		}
		resp.Data = append(resp.Data, h)
	}
	return resp, nil
}
