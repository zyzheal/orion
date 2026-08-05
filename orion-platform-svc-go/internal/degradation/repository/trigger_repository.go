package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/degradation/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ErrNoTriggers is returned when no trigger results are found.
var ErrNoTriggers = errors.New("no triggers found")

// TriggerRepository persists DegradationTrigger and DegradationAction records.
type TriggerRepository struct {
	db *sqlx.DB
}

// NewTriggerRepository creates a new TriggerRepository.
func NewTriggerRepository(db *sqlx.DB) *TriggerRepository {
	return &TriggerRepository{db: db}
}

// CreateTrigger inserts a new degradation trigger.
func (r *TriggerRepository) CreateTrigger(ctx context.Context, trigger *models.DegradationTrigger) error {
	trigger.ID = uuid.New().String()
	trigger.CreatedAt = time.Now().UTC()
	trigger.UpdatedAt = time.Now().UTC()

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO degradation_triggers (id, tenant_id, policy_id, status, reason,
			error_rate, latency_ms, triggered_at, created_at, updated_at)
		VALUES (:id, :tenant_id, :policy_id, :status, :reason,
			:error_rate, :latency_ms, :triggered_at, :created_at, :updated_at)
	`, trigger)
	if err != nil {
		return fmt.Errorf("insert trigger: %w", err)
	}
	return nil
}

// GetActiveTrigger returns the current active trigger for a policy.
func (r *TriggerRepository) GetActiveTrigger(ctx context.Context, tenantID, policyID string) (*models.DegradationTrigger, error) {
	var t models.DegradationTrigger
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM degradation_triggers WHERE tenant_id=$1 AND policy_id=$2 AND status='active' ORDER BY triggered_at DESC LIMIT 1`,
		tenantID, policyID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNoTriggers
	}
	if err != nil {
		return nil, fmt.Errorf("query active trigger: %w", err)
	}
	return &t, nil
}

// ListTriggersByPolicy returns paginated trigger history for a policy.
func (r *TriggerRepository) ListTriggersByPolicy(ctx context.Context, tenantID, policyID string, limit, offset int) ([]*models.DegradationTrigger, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	var triggers []*models.DegradationTrigger
	err := r.db.SelectContext(ctx, &triggers,
		`SELECT * FROM degradation_triggers WHERE tenant_id=$1 AND policy_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
		tenantID, policyID, limit, offset)
	return triggers, err
}

// CountTriggersByPolicy returns the number of triggers for a policy.
func (r *TriggerRepository) CountTriggersByPolicy(ctx context.Context, tenantID, policyID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM degradation_triggers WHERE tenant_id=$1 AND policy_id=$2`,
		tenantID, policyID)
	return count, err
}

// CreateAction inserts a degradation action linked to a trigger.
func (r *TriggerRepository) CreateAction(ctx context.Context, action *models.DegradationAction) error {
	action.ID = uuid.New().String()
	action.CreatedAt = time.Now().UTC()

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO degradation_actions (id, trigger_id, tenant_id, action, detail, status, created_at)
		VALUES (:id, :trigger_id, :tenant_id, :action, :detail, :status, :created_at)
	`, action)
	if err != nil {
		return fmt.Errorf("insert action: %w", err)
	}
	return nil
}

// RevertAction marks an action as reverted.
func (r *TriggerRepository) RevertAction(ctx context.Context, tenantID, actionID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE degradation_actions SET status='reverted', updated_at=$1 WHERE id=$2 AND tenant_id=$3`,
		time.Now().UTC(), actionID, tenantID)
	return err
}

// GetAction returns a single action by id.
func (r *TriggerRepository) GetAction(ctx context.Context, tenantID, actionID string) (*models.DegradationAction, error) {
	var a models.DegradationAction
	err := r.db.GetContext(ctx, &a,
		`SELECT * FROM degradation_actions WHERE id=$1 AND tenant_id=$2`, actionID, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNoTriggers
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// ListActionsByTrigger returns all actions for a given trigger.
func (r *TriggerRepository) ListActionsByTrigger(ctx context.Context, tenantID, triggerID string) ([]models.DegradationAction, error) {
	var actions []models.DegradationAction
	err := r.db.SelectContext(ctx, &actions,
		`SELECT * FROM degradation_actions WHERE trigger_id=$1 AND tenant_id=$2 ORDER BY created_at ASC`,
		triggerID, tenantID)
	return actions, err
}

// GetLatestTriggerTime returns the timestamp of the most recent trigger for a policy,
// used for auto-trigger cooldown dedup.
func (r *TriggerRepository) GetLatestTriggerTime(ctx context.Context, tenantID, policyID string) (*time.Time, error) {
	var t sql.NullTime
	err := r.db.GetContext(ctx, &t,
		`SELECT MAX(triggered_at) FROM degradation_triggers WHERE tenant_id=$1 AND policy_id=$2`,
		tenantID, policyID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil // never triggered
	}
	if err != nil {
		return nil, err
	}
	if !t.Valid {
		return nil, nil
	}
	result := time.Time(t.Time)
	return &result, nil
}
