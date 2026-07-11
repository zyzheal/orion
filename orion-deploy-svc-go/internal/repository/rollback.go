package repository

import (
	"context"
	"time"
	"orion-deploy-svc-go/internal/models"
	"orion/go-common/pkg/database"
)

// RollbackRepository handles rollback records.
type RollbackRepository struct {
	db *database.DB
}

func NewRollbackRepository(db *database.DB) *RollbackRepository {
	return &RollbackRepository{db: db}
}

// Create inserts a new rollback record.
func (r *RollbackRepository) Create(ctx context.Context, tenantID string, rb *models.RollbackRecord) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO rollback_records
			(id, tenant_id, deployment_id, rollback_to_id, rollback_from_id,
			 reason, status, created_by, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
		rb.ID, tenantID, rb.DeploymentID, rb.RollbackToID, rb.RollbackFromID,
		rb.Reason, rb.Status, rb.CreatedBy,
	)
	return err
}

// GetByDeployment returns all rollback records for a deployment.
func (r *RollbackRepository) GetByDeployment(ctx context.Context, tenantID, deploymentID string) ([]models.RollbackRecord, error) {
	var records []models.RollbackRecord
	err := r.db.SelectContext(ctx, &records,
		`SELECT * FROM rollback_records
		 WHERE tenant_id = $1 AND deployment_id = $2
		 ORDER BY created_at DESC`, tenantID, deploymentID)
	return records, err
}

// UpdateStatus updates the status and completed_at of a rollback record.
func (r *RollbackRepository) UpdateStatus(ctx context.Context, tenantID, id, status string, completedAt *time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE rollback_records SET status = $1, completed_at = $2
		 WHERE tenant_id = $3 AND id = $4`, status, completedAt, tenantID, id)
	return err
}
