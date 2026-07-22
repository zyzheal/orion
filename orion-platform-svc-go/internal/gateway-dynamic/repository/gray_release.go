package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/gateway-dynamic/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrGrayReleaseNotFound = errors.New("gray release not found")
	ErrGrayReleaseConflict = errors.New("gray release already active")
)

// GrayReleaseRepository handles gray release DB persistence.
type GrayReleaseRepository struct {
	db *sqlx.DB
}

func NewGrayReleaseRepository(db *sqlx.DB) *GrayReleaseRepository {
	return &GrayReleaseRepository{db: db}
}

// Create persists a new gray release config.
func (r *GrayReleaseRepository) Create(ctx context.Context, tenantID, routeID string, config models.GrayReleaseConfig) (*models.GrayReleaseStatusResponse, error) {
	cfgJSON, err := json.Marshal(config)
	if err != nil {
		return nil, err
	}

	var existing bool
	err = r.db.QueryRowContext(ctx,
		"SELECT enabled FROM gateway_gray_release WHERE route_id = $1 AND tenant_id = $2",
		routeID, tenantID,
	).Scan(&existing)
	if err == sql.ErrNoRows {
		// First time - insert
		id := uuid.New().String()
		now := time.Now().UTC()
		_, err = r.db.ExecContext(ctx, `
			INSERT INTO gateway_gray_release (id, tenant_id, route_id, config, enabled, active_since, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
			id, tenantID, routeID, cfgJSON, config.Enabled, now, now,
		)
		if err != nil {
			return nil, err
		}
		return r.Get(ctx, tenantID, routeID)
	}
	if err != nil {
		return nil, err
	}
	if existing {
		return nil, ErrGrayReleaseConflict
	}
	return nil, nil
}

// Get retrieves gray release status for a route.
func (r *GrayReleaseRepository) Get(ctx context.Context, tenantID, routeID string) (*models.GrayReleaseStatusResponse, error) {
	var (
		id, cfgJSON, activeSince, createdAt, updatedAt string
		enabled bool
		rollbackCount int
		lastRollback *time.Time
	)
	err := r.db.QueryRowContext(ctx, `
		SELECT id, config, enabled, active_since, last_rollback, rollback_count, created_at, updated_at
		FROM gateway_gray_release
		WHERE route_id = $1 AND tenant_id = $2`,
		routeID, tenantID,
	).Scan(&id, &cfgJSON, &enabled, &activeSince, lastRollback, &rollbackCount, &createdAt, &updatedAt)
	if err == sql.ErrNoRows {
		return nil, ErrGrayReleaseNotFound
	}
	if err != nil {
		return nil, err
	}

	var config models.GrayReleaseConfig
	if err := json.Unmarshal([]byte(cfgJSON), &config); err != nil {
		return nil, err
	}

	var targetRef, rollbackRef models.RouteTargetRef
	if config.TargetRef != nil {
		targetRef = *config.TargetRef
	}
	if config.RollbackRef != nil {
		rollbackRef = *config.RollbackRef
	}

	return &models.GrayReleaseStatusResponse{
		RouteID:       routeID,
		Enabled:       enabled,
		Strategy:      config.Strategy,
		HeaderValue:   config.HeaderValue,
		Percentage:    config.Percentage,
		TargetRef:     targetRef,
		RollbackRef:   rollbackRef,
		ActiveSince:   parseTime(activeSince),
		LastRollback:  lastRollback,
		RollbackCount: rollbackCount,
	}, nil
}

// Update modifies an existing gray release config.
func (r *GrayReleaseRepository) Update(ctx context.Context, tenantID, routeID string, updates map[string]interface{}) (*models.GrayReleaseStatusResponse, error) {
	if len(updates) == 0 {
		return r.Get(ctx, tenantID, routeID)
	}

	// Build dynamic SQL with positional args
	setParts := make([]string, 0, len(updates)+1)
	args := make([]interface{}, 0, len(updates)+3)
	idx := 1

	for k, v := range updates {
		setParts = append(setParts, k+" = $"+strconv.Itoa(idx))
		args = append(args, v)
		idx++
	}

	// Always update updated_at
	setParts = append(setParts, "updated_at = $"+strconv.Itoa(idx))
	args = append(args, time.Now().UTC())
	idx++

	args = append(args, routeID, tenantID)

	_, err := r.db.ExecContext(ctx,
		"UPDATE gateway_gray_release SET "+strings.Join(setParts, ", ")+
			" WHERE route_id = $"+strconv.Itoa(idx-2)+" AND tenant_id = $"+strconv.Itoa(idx-1),
		args...,
	)
	if err != nil {
		return nil, err
	}
	return r.Get(ctx, tenantID, routeID)
}

// Enable activates gray release for a route.
func (r *GrayReleaseRepository) Enable(ctx context.Context, tenantID, routeID string) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE gateway_gray_release SET enabled = true, active_since = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE route_id = $1 AND tenant_id = $2",
		routeID, tenantID,
	)
	return err
}

// Disable deactivates gray release for a route.
func (r *GrayReleaseRepository) Disable(ctx context.Context, tenantID, routeID string) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE gateway_gray_release SET enabled = false, updated_at = CURRENT_TIMESTAMP WHERE route_id = $1 AND tenant_id = $2",
		routeID, tenantID,
	)
	return err
}

// Rollback performs a rollback on a gray release route.
func (r *GrayReleaseRepository) Rollback(ctx context.Context, tenantID, routeID string) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE gateway_gray_release SET enabled = false, last_rollback = CURRENT_TIMESTAMP, rollback_count = rollback_count + 1, updated_at = CURRENT_TIMESTAMP WHERE route_id = $1 AND tenant_id = $2",
		routeID, tenantID,
	)
	return err
}

// ListStats returns aggregate stats for a tenant.
func (r *GrayReleaseRepository) ListStats(ctx context.Context, tenantID string) (*models.GrayReleaseStatsResponse, error) {
	var total, grayEnabled, activeRollbacks int
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*), SUM(CASE WHEN enabled THEN 1 ELSE 0 END), SUM(CASE WHEN last_rollback IS NOT NULL THEN 1 ELSE 0 END)
		FROM gateway_gray_release WHERE tenant_id = $1`,
		tenantID,
	).Scan(&total, &grayEnabled, &activeRollbacks)
	if err != nil {
		return nil, err
	}
	return &models.GrayReleaseStatsResponse{
		TotalRoutes:     total,
		GrayEnabled:     grayEnabled,
		ActiveRollbacks: activeRollbacks,
	}, nil
}

// helper
func parseTime(t string) time.Time {
	if t == "" {
		return time.Time{}
	}
	parsed, err := time.Parse(time.RFC3339, t)
	if err != nil {
		return time.Now().UTC()
	}
	return parsed
}
