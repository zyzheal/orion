package repository

import (
	"context"
	"fmt"
	"orion/platform-svc-go/internal/ci-cd/deploy/models"
	"orion/go-common/pkg/database"
	"strings"
)

// DeployWindowRepository handles PostgreSQL operations for deploy windows.
type DeployWindowRepository struct {
	db *database.DB
}

func NewDeployWindowRepository(db *database.DB) *DeployWindowRepository {
	return &DeployWindowRepository{db: db}
}

// GetByID retrieves a deploy window by ID.
func (r *DeployWindowRepository) GetByID(ctx context.Context, id string) (*models.DeployWindow, error) {
	var w models.DeployWindow
	query := `SELECT id, tenant_id, environment_id, name, cron_expression, duration_minutes, timezone, status, created_by, created_at, updated_at
FROM deploy_windows WHERE id = $1`
	err := r.db.GetContext(ctx, &w, query, id)
	if err != nil {
		return nil, fmt.Errorf("deploy window not found: %w", err)
	}
	return &w, nil
}

// List returns filtered deploy windows with pagination.
func (r *DeployWindowRepository) List(ctx context.Context, tenantID, environmentID, status string, limit, offset int) ([]models.DeployWindow, error) {
	var windows []models.DeployWindow
	query := `SELECT id, tenant_id, environment_id, name, cron_expression, duration_minutes, timezone, status, created_by, created_at, updated_at
FROM deploy_windows WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if tenantID != "" {
		args = append(args, tenantID)
		query += fmt.Sprintf(" AND tenant_id = $%d", argIdx)
		argIdx++
	}
	if environmentID != "" {
		args = append(args, environmentID)
		query += fmt.Sprintf(" AND environment_id = $%d", argIdx)
		argIdx++
	}
	if status != "" {
		args = append(args, status)
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		argIdx++
	}

	query += " ORDER BY created_at DESC"
	args = append(args, limit, offset)
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)

	err := r.db.SelectContext(ctx, &windows, query, args...)
	if err != nil {
		return nil, err
	}
	return windows, nil
}

// Count returns the number of deploy windows matching filters.
func (r *DeployWindowRepository) Count(ctx context.Context, tenantID, environmentID, status string) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM deploy_windows WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if tenantID != "" {
		args = append(args, tenantID)
		query += fmt.Sprintf(" AND tenant_id = $%d", argIdx)
		argIdx++
	}
	if environmentID != "" {
		args = append(args, environmentID)
		query += fmt.Sprintf(" AND environment_id = $%d", argIdx)
		argIdx++
	}
	if status != "" {
		args = append(args, status)
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		argIdx++
	}

	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

// Create inserts a new deploy window.
func (r *DeployWindowRepository) Create(ctx context.Context, w *models.DeployWindow) error {
	query := `INSERT INTO deploy_windows (tenant_id, environment_id, name, cron_expression, duration_minutes, timezone, status, created_by)
VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
RETURNING id, created_at, updated_at`
	duration := w.DurationMinutes
	if duration == 0 {
		duration = 60
	}
	err := r.db.QueryRowContext(ctx, query,
		w.TenantID, w.EnvironmentID, w.Name, w.CronExpression, duration, w.Timezone, w.CreatedBy,
	).Scan(&w.ID, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		return err
	}
	w.DurationMinutes = duration
	w.Timezone = w.Timezone
	if w.Timezone == "" {
		w.Timezone = "Asia/Shanghai"
	}
	w.Status = "active"
	return nil
}

// Update updates deploy window fields.
func (r *DeployWindowRepository) Update(ctx context.Context, id string, updates map[string]interface{}) (*models.DeployWindow, error) {
	sets := []string{}
	args := []interface{}{}
	argIdx := 1

	for k, v := range updates {
		switch k {
		case "name":
			args = append(args, v)
			sets = append(sets, fmt.Sprintf("name = $%d", argIdx))
		case "cron_expression":
			args = append(args, v)
			sets = append(sets, fmt.Sprintf("cron_expression = $%d", argIdx))
		case "duration_minutes":
			args = append(args, v)
			sets = append(sets, fmt.Sprintf("duration_minutes = $%d", argIdx))
		case "timezone":
			args = append(args, v)
			sets = append(sets, fmt.Sprintf("timezone = $%d", argIdx))
		case "status":
			sets = append(sets, "status = $"+fmt.Sprintf("%d", len(args)+1))
			args = append(args, v)
		}
		argIdx++
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}

	sets = append(sets, "updated_at = NOW()")
	args = append(args, id)
	setStr := strings.Join(sets, ", ")

	var w models.DeployWindow
	query := fmt.Sprintf(`UPDATE deploy_windows SET %s WHERE id = $%d
RETURNING id, tenant_id, environment_id, name, cron_expression, duration_minutes, timezone, status, created_by, created_at, updated_at`, setStr, len(args))
	err := r.db.GetContext(ctx, &w, query, args...)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

// SoftDelete sets the status to 'deleted'.
func (r *DeployWindowRepository) SoftDelete(ctx context.Context, id string) (*models.DeployWindow, error) {
	var w models.DeployWindow
	query := `UPDATE deploy_windows SET status = 'deleted', updated_at = NOW()
WHERE id = $1
RETURNING id, tenant_id, environment_id, name, cron_expression, duration_minutes, timezone, status, created_by, created_at, updated_at`
	err := r.db.GetContext(ctx, &w, query, id)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

// GetActiveWindows returns all active windows for a tenant and environment.
func (r *DeployWindowRepository) GetActiveWindows(ctx context.Context, tenantID, environmentID string) ([]models.DeployWindow, error) {
	var windows []models.DeployWindow
	query := `SELECT id, tenant_id, environment_id, name, cron_expression, duration_minutes, timezone, status, created_by, created_at, updated_at
FROM deploy_windows WHERE tenant_id = $1 AND environment_id = $2 AND status = 'active'
ORDER BY created_at DESC`
	err := r.db.SelectContext(ctx, &windows, query, tenantID, environmentID)
	if err != nil {
		return nil, err
	}
	return windows, nil
}
