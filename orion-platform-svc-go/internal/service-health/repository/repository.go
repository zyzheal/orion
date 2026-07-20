package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/service-health/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

// sentinel.NotFound is returned when a health check is not found within a tenant.

// Repository provides data access for the service_health_checks and
// service_health_results tables.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository backed by sqlx.DB.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// CreateCheck inserts a new health check definition and returns the record.
func (r *Repository) CreateCheck(ctx context.Context, m *models.HealthCheck) error {
	m.ID = uuid.New().String()
	m.LastStatus = models.StatusUNKNOWN
	m.ConsecutiveFailures = 0
	now := time.Now().UTC()
	m.CreatedAt = now
	m.UpdatedAt = now
	if m.CheckType == "" {
		m.CheckType = models.CheckTypeHTTP
	}
	if m.IntervalSeconds <= 0 {
		m.IntervalSeconds = 60
	}
	if m.TimeoutSeconds <= 0 {
		m.TimeoutSeconds = 10
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO service_health_checks (
			id, tenant_id, service_name, check_type, endpoint, interval_seconds,
			timeout_seconds, last_status, last_check_at, consecutive_failures,
			metadata, enabled, created_at, updated_at
		) VALUES (
			:id, :tenant_id, :service_name, :check_type, :endpoint, :interval_seconds,
			:timeout_seconds, :last_status, :last_check_at, :consecutive_failures,
			:metadata, :enabled, :created_at, :updated_at
		)`, m)
	return err
}

// GetCheckByID retrieves a health check by id within a tenant.
func (r *Repository) GetCheckByID(ctx context.Context, tenantID, id string) (*models.HealthCheck, error) {
	var m models.HealthCheck
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM service_health_checks WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("health check not found: %s", id)
		}
		return nil, err
	}
	return &m, nil
}

// GetCheckByIDWithoutTenant retrieves a health check by id without tenant filter.
// Used internally by the service layer for operations that need the full row
// but already performed tenant verification.
func (r *Repository) GetCheckByIDWithoutTenant(ctx context.Context, id string) (*models.HealthCheck, error) {
	var m models.HealthCheck
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM service_health_checks WHERE id = $1`, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("health check not found: %s", id)
		}
		return nil, err
	}
	return &m, nil
}

// ListChecks returns all health checks for a tenant, ordered by creation.
func (r *Repository) ListChecks(ctx context.Context, tenantID string) ([]models.HealthCheck, error) {
	var items []models.HealthCheck
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM service_health_checks WHERE tenant_id = $1 ORDER BY service_name, created_at DESC`, tenantID)
	return items, err
}

// UpdateCheck updates fields on an existing health check and returns the updated record.
func (r *Repository) UpdateCheck(ctx context.Context, tenantID, id string, m *models.HealthCheck) (*models.HealthCheck, error) {
	_, err := r.db.NamedExecContext(ctx, `
		UPDATE service_health_checks SET
			service_name = :service_name,
			check_type = :check_type,
			endpoint = :endpoint,
			interval_seconds = :interval_seconds,
			timeout_seconds = :timeout_seconds,
			metadata = :metadata,
			enabled = :enabled,
			updated_at = :updated_at
		WHERE id = :id AND tenant_id = :tenant_id`, m)
	if err != nil {
		return nil, err
	}
	return r.GetCheckByID(ctx, tenantID, id)
}

// DeleteCheck deletes a health check within a tenant.
func (r *Repository) DeleteCheck(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM service_health_checks WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// RecordResult inserts a new health check result row.
func (r *Repository) RecordResult(ctx context.Context, checkID string, status models.LastStatus, responseTimeMs int64, errMsg string, checkedAt time.Time) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO service_health_results (check_id, status, response_time_ms, error, checked_at)
		VALUES (:check_id, :status, :response_time_ms, :error, :checked_at)`,
		map[string]interface{}{
			"check_id":       checkID,
			"status":         status,
			"response_time_ms": responseTimeMs,
			"error":          errMsg,
			"checked_at":     checkedAt,
		})
	return err
}

// GetRecentResults returns the most recent N results for a given check.
func (r *Repository) GetRecentResults(ctx context.Context, checkID string, limit int) ([]models.HealthResult, error) {
	if limit <= 0 {
		limit = 20
	}
	var results []models.HealthResult
	err := r.db.SelectContext(ctx, &results,
		`SELECT * FROM service_health_results WHERE check_id = $1 ORDER BY checked_at DESC LIMIT $2`, checkID, limit)
	if err != nil {
		return nil, err
	}
	return results, nil
}

// GetSummary computes the health summary for a service within a tenant over the
// last 24 hours of results.
func (r *Repository) GetSummary(ctx context.Context, tenantID, serviceName string) (*models.HealthSummary, error) {
	cutoff := time.Now().UTC().Add(-24 * time.Hour)
	var s models.HealthSummary
	err := r.db.GetContext(ctx, &s, `
		SELECT
			cs.service_name          AS service_name,
			cs.last_status           AS status,
			CASE
				WHEN SUM(CASE WHEN r.status = $1 THEN 1 ELSE 0 END) = 0 THEN 0
				ELSE ROUND(
					SUM(CASE WHEN r.status = $1 THEN 1 ELSE 0 END)::numeric * 100.0 /
					NULLIF(COUNT(r.id)::numeric, 0),
					2)
			END                     AS uptime_percent,
			cs.last_check_at         AS last_check_at,
			COUNT(r.id)              AS total_checks,
			SUM(CASE WHEN r.status = $1 THEN 0 ELSE 1 END) AS failed_checks
		FROM service_health_checks cs
		LEFT JOIN service_health_results r
			ON r.check_id = cs.id
			AND r.checked_at >= $2
		WHERE cs.tenant_id = $3 AND cs.service_name = $4
		GROUP BY cs.id, cs.service_name, cs.last_status, cs.last_check_at`,
		models.StatusUP, cutoff, tenantID, serviceName)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &s, nil
}

// GetAllSummaries returns health summaries for every service within a tenant.
func (r *Repository) GetAllSummaries(ctx context.Context, tenantID string) ([]models.HealthSummary, error) {
	cutoff := time.Now().UTC().Add(-24 * time.Hour)
	var summaries []models.HealthSummary
	err := r.db.SelectContext(ctx, &summaries, `
		SELECT
			cs.service_name          AS service_name,
			cs.last_status           AS status,
			CASE
				WHEN SUM(CASE WHEN r.status = $1 THEN 1 ELSE 0 END) = 0 THEN 0
				ELSE ROUND(
					SUM(CASE WHEN r.status = $1 THEN 1 ELSE 0 END)::numeric * 100.0 /
					NULLIF(COUNT(r.id)::numeric, 0),
					2)
			END                     AS uptime_percent,
			cs.last_check_at         AS last_check_at,
			COUNT(r.id)              AS total_checks,
			SUM(CASE WHEN r.status = $1 THEN 0 ELSE 1 END) AS failed_checks
		FROM service_health_checks cs
		LEFT JOIN service_health_results r
			ON r.check_id = cs.id
			AND r.checked_at >= $2
		WHERE cs.tenant_id = $3
		GROUP BY cs.id, cs.service_name, cs.last_status, cs.last_check_at
		ORDER BY cs.service_name`,
		models.StatusUP, cutoff, tenantID)
	return summaries, err
}

// GetDegradedServices returns summaries for services whose uptime falls below
// the given threshold (percentage) within the last 24 hours.
func (r *Repository) GetDegradedServices(ctx context.Context, tenantID string, thresholdUptime float64) ([]models.HealthSummary, error) {
	cutoff := time.Now().UTC().Add(-24 * time.Hour)
	var summaries []models.HealthSummary
	err := r.db.SelectContext(ctx, &summaries, `
		SELECT
			cs.service_name          AS service_name,
			cs.last_status           AS status,
			CASE
				WHEN SUM(CASE WHEN r.status = $1 THEN 1 ELSE 0 END) = 0 THEN 0
				ELSE ROUND(
					SUM(CASE WHEN r.status = $1 THEN 1 ELSE 0 END)::numeric * 100.0 /
					NULLIF(COUNT(r.id)::numeric, 0),
					2)
			END                     AS uptime_percent,
			cs.last_check_at         AS last_check_at,
			COUNT(r.id)              AS total_checks,
			SUM(CASE WHEN r.status = $1 THEN 0 ELSE 1 END) AS failed_checks
		FROM service_health_checks cs
		LEFT JOIN service_health_results r
			ON r.check_id = cs.id
			AND r.checked_at >= $2
		WHERE cs.tenant_id = $3
		GROUP BY cs.id, cs.service_name, cs.last_status, cs.last_check_at
		HAVING uptime_percent < $4
		ORDER BY uptime_percent ASC`,
		models.StatusUP, cutoff, tenantID, thresholdUptime)
	if err != nil {
		return nil, err
	}
	return summaries, nil
}

// UpdateLastStatus updates last_status, last_check_at, and consecutive_failures
// for a given check id. This is used by the service layer after recording a result.
func (r *Repository) UpdateLastStatus(ctx context.Context, id string, status models.LastStatus, consecutiveFailures int, checkedAt time.Time) error {
	_, err := r.db.NamedExecContext(ctx, `
		UPDATE service_health_checks SET
			last_status = :last_status,
			last_check_at = :last_check_at,
			consecutive_failures = :consecutive_failures,
			updated_at = :updated_at
		WHERE id = :id`,
		map[string]interface{}{
			"id":                   id,
			"last_status":          status,
			"last_check_at":        checkedAt,
			"consecutive_failures": consecutiveFailures,
			"updated_at":           time.Now().UTC(),
		})
	return err
}
