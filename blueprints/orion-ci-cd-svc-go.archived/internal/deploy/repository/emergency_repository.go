package repository

import (
	"context"
	"database/sql"
	"fmt"
	"orion/ci-cd-svc-go/internal/deploy/models"
	"orion/go-common/pkg/database"
)

// EmergencyRepository handles PostgreSQL operations for emergency deployments.
type EmergencyRepository struct {
	db *database.DB
}

func NewEmergencyRepository(db *database.DB) *EmergencyRepository {
	return &EmergencyRepository{db: db}
}

// GetByID retrieves an emergency deploy by ID.
func (r *EmergencyRepository) GetByID(ctx context.Context, id string) (*models.DeployEmergency, error) {
	var e models.DeployEmergency
	query := `SELECT id, tenant_id, deployment_id, reason, requested_by, approved_by, approved_at, started_at, completed_at, status, post_mortem, metadata, created_at, updated_at
FROM deploy_emergencies WHERE id = $1`
	err := r.db.GetContext(ctx, &e, query, id)
	if err != nil {
		return nil, fmt.Errorf("emergency deploy not found: %w", err)
	}
	return &e, nil
}

// List returns filtered emergency deploys with pagination.
func (r *EmergencyRepository) List(ctx context.Context, tenantID, status string, limit, offset int) ([]models.DeployEmergency, error) {
	var emergencies []models.DeployEmergency
	query := `SELECT id, tenant_id, deployment_id, reason, requested_by, approved_by, approved_at, started_at, completed_at, status, post_mortem, metadata, created_at, updated_at
FROM deploy_emergencies WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if tenantID != "" {
		args = append(args, tenantID)
		query += fmt.Sprintf(" AND tenant_id = $%d", argIdx)
		argIdx++
	}
	if status != "" {
		args = append(args, status)
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		argIdx++
	}

	args = append(args, limit, offset)
	query += " ORDER BY created_at DESC LIMIT $" + fmt.Sprintf("%d", argIdx) + " OFFSET $" + fmt.Sprintf("%d", argIdx+1)

	err := r.db.SelectContext(ctx, &emergencies, query, args...)
	if err != nil {
		return nil, err
	}
	return emergencies, nil
}

// Count returns the count of emergency deploys matching filters.
func (r *EmergencyRepository) Count(ctx context.Context, tenantID, status string) (int, error) {
	var count int
query := `SELECT COUNT(*) FROM deploy_emergencies WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if tenantID != "" {
		args = append(args, tenantID)
		query += fmt.Sprintf(" AND tenant_id = $%d", argIdx)
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

// Create inserts a new emergency deploy request.
func (r *EmergencyRepository) Create(ctx context.Context, e *models.DeployEmergency) error {
	query := `INSERT INTO deploy_emergencies (tenant_id, deployment_id, reason, requested_by, status)
VALUES ($1, $2, $3, $4, 'pending')
RETURNING id, started_at, created_at, updated_at`
	err := r.db.QueryRowContext(ctx, query,
		e.TenantID, e.DeploymentID, e.Reason, e.RequestedBy,
	).Scan(&e.ID, &e.StartedAt, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		return err
	}
	e.Status = "pending"
	return nil
}

// Approve sets status to approved and records approver.
func (r *EmergencyRepository) Approve(ctx context.Context, id string, approvedBy string) (*models.DeployEmergency, error) {
	var e models.DeployEmergency
	query := `UPDATE deploy_emergencies
SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
WHERE id = $2
RETURNING id, tenant_id, deployment_id, reason, requested_by, approved_by, approved_at, started_at, completed_at, status, post_mortem, metadata, created_at, updated_at`
	err := r.db.GetContext(ctx, &e, query, approvedBy, id)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

// Reject sets status to rejected.
func (r *EmergencyRepository) Reject(ctx context.Context, id string) (*models.DeployEmergency, error) {
	var e models.DeployEmergency
	query := `UPDATE deploy_emergencies
SET status = 'rejected', updated_at = NOW()
WHERE id = $1
RETURNING id, tenant_id, deployment_id, reason, requested_by, approved_by, approved_at, started_at, completed_at, status, post_mortem, metadata, created_at, updated_at`
	err := r.db.GetContext(ctx, &e, query, id)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

// Complete sets status to completed with optional post-mortem.
func (r *EmergencyRepository) Complete(ctx context.Context, id string, postMortem sql.NullString) (*models.DeployEmergency, error) {
	var e models.DeployEmergency
	query := `UPDATE deploy_emergencies
SET status = 'completed', completed_at = NOW(), post_mortem = $1, updated_at = NOW()
WHERE id = $2
RETURNING id, tenant_id, deployment_id, reason, requested_by, approved_by, approved_at, started_at, completed_at, status, post_mortem, metadata, created_at, updated_at`
	err := r.db.GetContext(ctx, &e, query, postMortem, id)
	if err != nil {
		return nil, err
	}
	return &e, nil
}
