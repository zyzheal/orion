package repository

import (
	"context"
	"fmt"
	"orion/deploy-svc-go/internal/models"
	"time"

	"github.com/jmoiron/sqlx"
)

type DeploymentRepository struct {
	db *sqlx.DB
}

func NewDeploymentRepository(db *sqlx.DB) *DeploymentRepository {
	return &DeploymentRepository{db: db}
}

// ==================== Deployment CRUD ====================

// Create inserts a new deployment record.
func (r *DeploymentRepository) Create(ctx context.Context, d *models.Deployment) error {
	query := `
		INSERT INTO deployments (tenant_id, environment, service_name, version, image_tag, status, strategy, deployed_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at
	`
	strategy := d.Strategy
	if strategy == "" {
		strategy = "rolling"
	}
	err := r.db.QueryRowContext(ctx, query,
		d.TenantID, d.Environment, d.ServiceName, d.Version, d.ImageTag, d.Status, strategy, d.DeployedBy,
	).Scan(&d.ID, &d.CreatedAt)
	if err != nil {
		return err
	}
	now := time.Now()
	d.DeployedAt = &now
	return nil
}

// GetByID retrieves a deployment by ID, scoped to tenant.
func (r *DeploymentRepository) GetByID(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	var d models.Deployment
	query := `SELECT id, tenant_id, environment, service_name, version, image_tag, status, strategy, deployed_by, rollback_to, error_message, started_at, completed_at, duration_ms, deployed_at, created_at FROM deployments WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &d, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("deployment not found: %w", err)
	}
	return &d, nil
}

// GetByIDAny retrieves a deployment by ID without tenant scoping.
// DEPRECATED: Use GetByID with tenantID instead. Retained only for cross-service
// internal calls where tenant context is not available (e.g. rollback triggers).
func (r *DeploymentRepository) GetByIDAny(ctx context.Context, id string) (*models.Deployment, error) {
	var d models.Deployment
	query := `SELECT id, tenant_id, environment, service_name, version, image_tag, status, strategy, deployed_by, rollback_to, error_message, started_at, completed_at, duration_ms, deployed_at, created_at FROM deployments WHERE id = $1`
	err := r.db.GetContext(ctx, &d, query, id)
	if err != nil {
		return nil, fmt.Errorf("deployment not found: %w", err)
	}
	return &d, nil
}

// List returns paginated deployments for a tenant.
func (r *DeploymentRepository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Deployment, error) {
	var deployments []models.Deployment
	query := `SELECT id, tenant_id, environment, service_name, version, image_tag, status, strategy, deployed_by, rollback_to, error_message, started_at, completed_at, duration_ms, deployed_at, created_at FROM deployments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	err := r.db.SelectContext(ctx, &deployments, query, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return deployments, nil
}

// ListByFilter returns filtered deployments with pagination.
func (r *DeploymentRepository) ListByFilter(ctx context.Context, tenantID, environment, status string, offset, limit int) ([]models.Deployment, error) {
	var deployments []models.Deployment
	query := `SELECT id, tenant_id, environment, service_name, version, image_tag, status, strategy, deployed_by, rollback_to, error_message, started_at, completed_at, duration_ms, deployed_at, created_at FROM deployments WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if environment != "" {
		query += fmt.Sprintf(" AND environment = $%d", argIdx)
		args = append(args, environment)
		argIdx++
	}
	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	query += " ORDER BY created_at DESC"
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	err := r.db.SelectContext(ctx, &deployments, query, args...)
	if err != nil {
		return nil, err
	}
	return deployments, nil
}

// Update persists changes to a deployment.
func (r *DeploymentRepository) Update(ctx context.Context, d *models.Deployment) error {
	query := `
		UPDATE deployments SET environment = $1, service_name = $2, version = $3, image_tag = $4, status = $5, strategy = $6, deployed_by = $7, rollback_to = $8, error_message = $9, deployed_at = NOW()
		WHERE id = $10 AND tenant_id = $11
	`
	_, err := r.db.ExecContext(ctx, query, d.Environment, d.ServiceName, d.Version, d.ImageTag, d.Status, d.Strategy, d.DeployedBy, d.RollbackTo, d.ErrorMessage, d.ID, d.TenantID)
	return err
}

// UpdateStatus changes only the status of a deployment.
func (r *DeploymentRepository) UpdateStatus(ctx context.Context, tenantID, id, status string) error {
	query := `UPDATE deployments SET status = $1 WHERE id = $2 AND tenant_id = $3`
	_, err := r.db.ExecContext(ctx, query, status, id, tenantID)
	return err
}

// Delete removes a deployment by ID.
func (r *DeploymentRepository) Delete(ctx context.Context, tenantID, id string) error {
	query := `DELETE FROM deployments WHERE id = $1 AND tenant_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, tenantID)
	return err
}

// Count returns total deployments for a tenant.
func (r *DeploymentRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM deployments WHERE tenant_id = $1`, tenantID)
	return count, err
}

// ==================== Status Transitions ====================

// StartDeployment transitions a deployment from pending to deploying, scoped to tenant.
func (r *DeploymentRepository) StartDeployment(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	query := `UPDATE deployments SET status = 'deploying', started_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id, tenant_id, environment, service_name, version, image_tag, status, strategy, deployed_by, rollback_to, error_message, started_at, completed_at, duration_ms, deployed_at, created_at`
	var d models.Deployment
	err := r.db.GetContext(ctx, &d, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to start deployment: %w", err)
	}
	return &d, nil
}

// CompleteDeployment transitions a deployment to a terminal state (success/failed/cancelled), scoped to tenant.
func (r *DeploymentRepository) CompleteDeployment(ctx context.Context, tenantID, id, status string, errorMsg *string) (*models.Deployment, error) {
	query := `UPDATE deployments SET
		status = $1,
		completed_at = NOW(),
		duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at))::BIGINT * 1000,
		error_message = $2
	WHERE id = $3 AND tenant_id = $4
	RETURNING id, tenant_id, environment, service_name, version, image_tag, status, strategy, deployed_by, rollback_to, error_message, started_at, completed_at, duration_ms, deployed_at, created_at`
	var d models.Deployment
	err := r.db.GetContext(ctx, &d, query, status, errorMsg, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to complete deployment: %w", err)
	}
	return &d, nil
}

// ==================== Queries ====================

// FindLatestByEnvironment returns the most recent deployment for a tenant+environment.
func (r *DeploymentRepository) FindLatestByEnvironment(ctx context.Context, tenantID, environment string) (*models.Deployment, error) {
	var d models.Deployment
	query := `SELECT id, tenant_id, environment, service_name, version, image_tag, status, strategy, deployed_by, rollback_to, error_message, started_at, completed_at, duration_ms, deployed_at, created_at FROM deployments WHERE tenant_id = $1 AND environment = $2 ORDER BY created_at DESC LIMIT 1`
	err := r.db.GetContext(ctx, &d, query, tenantID, environment)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// FindByBuild returns all deployments for a given build, scoped to tenant.
func (r *DeploymentRepository) FindByBuild(ctx context.Context, tenantID, buildID string) ([]models.Deployment, error) {
	var deployments []models.Deployment
	query := `SELECT id, tenant_id, environment, service_name, version, image_tag, status, strategy, deployed_by, rollback_to, error_message, started_at, completed_at, duration_ms, deployed_at, created_at FROM deployments WHERE tenant_id = $1 AND image_tag = $2 ORDER BY created_at DESC`
	err := r.db.SelectContext(ctx, &deployments, query, tenantID, buildID)
	if err != nil {
		return nil, err
	}
	return deployments, nil
}

// FindRollbackTarget finds the previous successful deployment for rollback.
func (r *DeploymentRepository) FindRollbackTarget(ctx context.Context, tenantID, environment, currentID string) (*models.Deployment, error) {
	var d models.Deployment
	query := `SELECT id, tenant_id, environment, service_name, version, image_tag, status, strategy, deployed_by, rollback_to, error_message, started_at, completed_at, duration_ms, deployed_at, created_at FROM deployments WHERE tenant_id = $1 AND environment = $2 AND status = 'success' AND id != $3 ORDER BY created_at DESC LIMIT 1`
	err := r.db.GetContext(ctx, &d, query, tenantID, environment, currentID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// GetEnvironments returns distinct environments for a tenant.
func (r *DeploymentRepository) GetEnvironments(ctx context.Context, tenantID string) ([]string, error) {
	var envs []string
	query := `SELECT DISTINCT environment FROM deployments WHERE tenant_id = $1 AND environment IS NOT NULL AND environment != '' ORDER BY environment`
	err := r.db.SelectContext(ctx, &envs, query, tenantID)
	if err != nil {
		return nil, err
	}
	return envs, nil
}

// GetDeployStats returns aggregate deployment statistics.
func (r *DeploymentRepository) GetDeployStats(ctx context.Context, tenantID string) (*models.DeployStats, error) {
	var stats models.DeployStats
	query := `SELECT
		COUNT(*)::INT AS total,
		COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0)::INT AS success,
		COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0)::INT AS failed,
		COALESCE(SUM(CASE WHEN status = 'deploying' THEN 1 ELSE 0 END), 0)::INT AS deploying,
		COALESCE(AVG(duration_ms), 0)::FLOAT AS avg_duration
	FROM deployments WHERE tenant_id = $1`
	err := r.db.GetContext(ctx, &stats, query, tenantID)
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

// UpdateRollbackTo sets the rollback_to reference on a deployment, scoped to tenant.
func (r *DeploymentRepository) UpdateRollbackTo(ctx context.Context, tenantID, id, rollbackTo string) error {
	query := `UPDATE deployments SET rollback_to = $1 WHERE id = $2 AND tenant_id = $3`
	_, err := r.db.ExecContext(ctx, query, rollbackTo, id, tenantID)
	return err
}

// ==================== Deployment Events ====================

// CreateEvent inserts a deployment event (audit log entry).
func (r *DeploymentRepository) CreateEvent(ctx context.Context, e *models.DeploymentEvent) error {
	query := `INSERT INTO deployment_events (deployment_id, event_type, message, actor_id) VALUES ($1, $2, $3, $4) RETURNING id, created_at`
	return r.db.QueryRowContext(ctx, query, e.DeploymentID, e.EventType, e.Message, e.ActorID).Scan(&e.ID, &e.CreatedAt)
}

// FindEvents returns all events for a deployment, ordered chronologically.
func (r *DeploymentRepository) FindEvents(ctx context.Context, deploymentID string) ([]models.DeploymentEvent, error) {
	var events []models.DeploymentEvent
	query := `SELECT id, deployment_id, event_type, message, actor_id, created_at FROM deployment_events WHERE deployment_id = $1 ORDER BY created_at ASC`
	err := r.db.SelectContext(ctx, &events, query, deploymentID)
	if err != nil {
		return nil, err
	}
	return events, nil
}
