package repository

import (
	"context"

	"orion-deploy-svc-go/internal/models"
	"orion/go-common/pkg/database"
)

// AuditRepository handles audit events for deployments.
type AuditRepository struct {
	db *database.DB
}

func NewAuditRepository(db *database.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

// Create inserts an audit event.
func (r *AuditRepository) Create(ctx context.Context, tenantID string, e *models.AuditEvent) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO deployment_audit
			(id, tenant_id, deployment_id, action, actor, detail, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
		e.ID, tenantID, e.DeploymentID, e.Action, e.Actor, e.Detail,
	)
	return err
}

// GetByDeployment returns all audit events for a deployment.
func (r *AuditRepository) GetByDeployment(ctx context.Context, tenantID, deploymentID string) ([]models.AuditEvent, error) {
	var events []models.AuditEvent
	err := r.db.SelectContext(ctx, &events,
		`SELECT * FROM deployment_audit
		 WHERE tenant_id = $1 AND deployment_id = $2
		 ORDER BY created_at DESC`, tenantID, deploymentID)
	return events, err
}
