package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/circuit-breaker/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository provides data access for the circuit-breaker module.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository backed by the given sqlx DB.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

// Create inserts a new circuit breaker.
func (r *Repository) Create(ctx context.Context, cb *models.CircuitBreaker) error {
	cb.ID = uuid.New().String()
	now := time.Now().UTC()
	cb.CreatedAt = now
	cb.UpdatedAt = now
	cb.LastStateChangeAt = now

	// Defaults
	if cb.State == "" {
		cb.State = models.StateClosed
	}
	if cb.FailureThreshold <= 0 {
		cb.FailureThreshold = 5
	}
	if cb.SuccessThreshold <= 0 {
		cb.SuccessThreshold = 3
	}
	if cb.TimeoutSeconds <= 0 {
		cb.TimeoutSeconds = 60
	}
	cb.Enabled = true
	cb.FailureCount = 0

	query := `INSERT INTO circuit_breakers (
		id, tenant_id, name, service_name, failure_threshold, success_threshold,
		timeout_seconds, state, failure_count, last_state_change_at,
		metadata, enabled, created_at, updated_at
	) VALUES (
		:id, :tenant_id, :name, :service_name, :failure_threshold, :success_threshold,
		:timeout_seconds, :state, :failure_count, :last_state_change_at,
		:metadata, :enabled, :created_at, :updated_at
	)`

	_, err := r.db.NamedExecContext(ctx, query, cb)
	return err
}

// GetByID retrieves a single circuit breaker by ID, filtered by tenant.
func (r *Repository) GetByID(ctx context.Context, id, tenantID string) (*models.CircuitBreaker, error) {
	var cb models.CircuitBreaker
	err := r.db.GetContext(ctx, &cb,
		`SELECT * FROM circuit_breakers WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &cb, nil
}

// List returns all circuit breakers for a tenant, ordered by created_at DESC.
func (r *Repository) List(ctx context.Context, tenantID string) ([]models.CircuitBreaker, error) {
	var cbs []models.CircuitBreaker
	err := r.db.SelectContext(ctx, &cbs,
		`SELECT * FROM circuit_breakers WHERE tenant_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	if cbs == nil {
		cbs = []models.CircuitBreaker{}
	}
	return cbs, nil
}

// Update patches a circuit breaker's fields. Map keys are DB column names.
func (r *Repository) Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.CircuitBreaker, error) {
	if len(attrs) == 0 {
		return nil, sentinel.NotFound
	}
	attrs["updated_at"] = time.Now().UTC()

	setParts := make([]string, 0, len(attrs))
	args := make([]interface{}, 0, len(attrs)+2)
	argIdx := 1
	for key := range attrs {
		setParts = append(setParts, fmt.Sprintf("%s=$%d", key, argIdx))
		args = append(args, attrs[key])
		argIdx++
	}
	idIdx := len(args) + 1
	tenantIdx := len(args) + 2
	args = append(args, id, tenantID)

	query := "UPDATE circuit_breakers SET " + strings.Join(setParts, ", ") +
		fmt.Sprintf(" WHERE id=$%d AND tenant_id=$%d AND deleted_at IS NULL", idIdx, tenantIdx)

	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, id, tenantID)
}

// Delete soft-deletes a circuit breaker.
func (r *Repository) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`UPDATE circuit_breakers SET deleted_at=NOW() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
		id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// ---------------------------------------------------------------------------
// State machine operations
// ---------------------------------------------------------------------------

// UpdateState changes the state of a circuit breaker and records the event.
func (r *Repository) UpdateState(ctx context.Context, cbID, tenantID, newState, reason string) error {
	// Get current state
	var currentState string
	err := r.db.GetContext(ctx, &currentState,
		`SELECT state FROM circuit_breakers WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, cbID, tenantID)
	if err != nil {
		return err
	}

	// Update state
	_, err = r.db.ExecContext(ctx,
		`UPDATE circuit_breakers SET state=$1, last_state_change_at=NOW(), updated_at=NOW() WHERE id=$2 AND tenant_id=$3 AND deleted_at IS NULL`,
		newState, cbID, tenantID)
	if err != nil {
		return err
	}

	// Record event
	eventID := uuid.New().String()
	_, err = r.db.ExecContext(ctx,
		`INSERT INTO circuit_breaker_events (id, circuit_breaker_id, tenant_id, previous_state, new_state, reason, timestamp)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
		eventID, cbID, tenantID, currentState, newState, reason)
	return err
}

// IncrementFailures increments the failure count and records the last failure time.
func (r *Repository) IncrementFailures(ctx context.Context, cbID, tenantID string) (int, error) {
	var newCount int
	err := r.db.QueryRowContext(ctx,
		`UPDATE circuit_breakers SET failure_count=failure_count+1, last_failure_at=NOW(), updated_at=NOW() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL RETURNING failure_count`,
		cbID, tenantID).Scan(&newCount)
	return newCount, err
}

// ResetFailures resets the failure count to zero.
func (r *Repository) ResetFailures(ctx context.Context, cbID, tenantID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE circuit_breakers SET failure_count=0, last_failure_at=NULL, updated_at=NOW() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
		cbID, tenantID)
	return err
}

// ListOpen returns all circuit breakers currently in OPEN state.
func (r *Repository) ListOpen(ctx context.Context, tenantID string) ([]models.CircuitBreaker, error) {
	var cbs []models.CircuitBreaker
	err := r.db.SelectContext(ctx, &cbs,
		`SELECT * FROM circuit_breakers WHERE tenant_id=$1 AND state=$2 AND deleted_at IS NULL ORDER BY last_state_change_at DESC`,
		tenantID, string(models.StateOpen))
	if err != nil {
		return nil, err
	}
	if cbs == nil {
		cbs = []models.CircuitBreaker{}
	}
	return cbs, nil
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

// GetRecentEvents returns recent events for a circuit breaker.
func (r *Repository) GetRecentEvents(ctx context.Context, cbID, tenantID string, limit int) ([]models.CircuitEvent, error) {
	if limit <= 0 {
		limit = 50
	}
	var events []models.CircuitEvent
	err := r.db.SelectContext(ctx, &events,
		`SELECT * FROM circuit_breaker_events WHERE circuit_breaker_id=$1 AND tenant_id=$2 ORDER BY timestamp DESC LIMIT $3`,
		cbID, tenantID, limit)
	if err != nil {
		return nil, err
	}
	if events == nil {
		events = []models.CircuitEvent{}
	}
	return events, nil
}
