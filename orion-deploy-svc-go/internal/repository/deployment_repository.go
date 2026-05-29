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

func (r *DeploymentRepository) Create(ctx context.Context, d *models.Deployment) error {
	query := `
		INSERT INTO deployments (tenant_id, environment, service_name, version, image_tag, status, deployed_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`
	now := time.Now()
	err := r.db.QueryRowContext(ctx, query,
		d.TenantID, d.Environment, d.ServiceName, d.Version, d.ImageTag, d.Status, d.DeployedBy,
	).Scan(&d.ID, &d.CreatedAt)
	if err != nil {
		return err
	}
	d.DeployedAt = &now
	return nil
}

func (r *DeploymentRepository) GetByID(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	var d models.Deployment
	query := `SELECT id, tenant_id, environment, service_name, version, image_tag, status, deployed_by, rollback_to, deployed_at, created_at FROM deployments WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &d, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("deployment not found: %w", err)
	}
	return &d, nil
}

func (r *DeploymentRepository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Deployment, error) {
	var deployments []models.Deployment
	query := `SELECT id, tenant_id, environment, service_name, version, image_tag, status, deployed_by, rollback_to, deployed_at, created_at FROM deployments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	err := r.db.SelectContext(ctx, &deployments, query, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return deployments, nil
}

func (r *DeploymentRepository) Update(ctx context.Context, d *models.Deployment) error {
	query := `
		UPDATE deployments SET environment = $1, service_name = $2, version = $3, image_tag = $4, status = $5, deployed_by = $6, rollback_to = $7, deployed_at = NOW()
		WHERE id = $8 AND tenant_id = $9
	`
	_, err := r.db.ExecContext(ctx, query, d.Environment, d.ServiceName, d.Version, d.ImageTag, d.Status, d.DeployedBy, d.RollbackTo, d.ID, d.TenantID)
	return err
}

func (r *DeploymentRepository) UpdateStatus(ctx context.Context, tenantID, id, status string) error {
	query := `UPDATE deployments SET status = $1 WHERE id = $2 AND tenant_id = $3`
	_, err := r.db.ExecContext(ctx, query, status, id, tenantID)
	return err
}

func (r *DeploymentRepository) Delete(ctx context.Context, tenantID, id string) error {
	query := `DELETE FROM deployments WHERE id = $1 AND tenant_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, tenantID)
	return err
}

func (r *DeploymentRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM deployments WHERE tenant_id=$1`, tenantID)
	return count, err
}
