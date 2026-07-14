package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/health-check/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository handles data access for health checks.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new health check repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new health check and returns its ID.
func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreateHealthCheckRequest) (string, error) {
	id := uuid.New().String()
	now := time.Now()
	if req.IntervalSec <= 0 {
		req.IntervalSec = 60
	}
	if req.URL == "" {
		req.URL = "http://localhost/health"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO health_checks (id, tenant_id, name, url, check_type, interval_sec, enabled, status, created_at, updated_at)
		 VALUES (:id, :tenantID, :name, :url, :checkType, :intervalSec, :enabled, :status, :createdAt, :updatedAt)`,
		map[string]interface{}{
			"id":          id,
			"tenantID":    tenantID,
			"name":        req.Name,
			"url":         req.URL,
			"checkType":   req.CheckType,
			"intervalSec": req.IntervalSec,
			"enabled":     true,
			"status":      "pending",
			"createdAt":   now,
			"updatedAt":   now,
		},
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

// Get retrieves a single health check by ID scoped to a tenant.
func (r *Repository) Get(ctx context.Context, tenantID, id string) (*models.HealthCheck, error) {
	var hc models.HealthCheck
	err := r.db.GetContext(ctx, &hc,
		`SELECT id, tenant_id, name, url, check_type, interval_sec, enabled, status, last_result, created_at, updated_at
		 FROM health_checks
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &hc, nil
}

// List returns all health checks for a tenant.
func (r *Repository) List(ctx context.Context, tenantID string) ([]models.HealthCheck, error) {
	var hcs []models.HealthCheck
	err := r.db.SelectContext(ctx, &hcs,
		`SELECT id, tenant_id, name, url, check_type, interval_sec, enabled, status, last_result, created_at, updated_at
		 FROM health_checks
		 WHERE tenant_id = $1
		 ORDER BY created_at DESC`,
		tenantID,
	)
	if err != nil {
		return nil, err
	}
	return hcs, nil
}

// Update modifies an existing health check scoped to a tenant.
func (r *Repository) Update(ctx context.Context, tenantID, id string, req models.CreateHealthCheckRequest) error {
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE health_checks
		 SET name = :name, url = :url, check_type = :checkType, interval_sec = :intervalSec, updated_at = :updatedAt
		 WHERE id = :id AND tenant_id = :tenantID`,
		map[string]interface{}{
			"name":        req.Name,
			"url":         req.URL,
			"checkType":   req.CheckType,
			"intervalSec": req.IntervalSec,
			"id":          id,
			"tenantID":    tenantID,
			"updatedAt":   time.Now(),
		},
	)
	return err
}

// Delete soft-deletes a health check by setting enabled to false.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE health_checks SET enabled = false, updated_at = NOW()
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	return err
}
