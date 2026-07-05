package repository

import (
	"context"
	"orion-cmdb-svc-go/internal/models"

	"orion/go-common/pkg/database"
)

type CIAuditRepository struct {
	db *database.DB
}

func NewCIAuditRepository(db *database.DB) *CIAuditRepository {
	return &CIAuditRepository{db: db}
}

func (r *CIAuditRepository) Create(ctx context.Context, log *models.CIAuditLog) error {
	query := `INSERT INTO ci_audit_log (id, tenant_id, ci_id, action, actor, old_value, new_value)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.ExecContext(ctx, query,
		log.ID, log.TenantID, log.CIID, log.Action, log.Actor, log.OldValue, log.NewValue,
	)
	return err
}

func (r *CIAuditRepository) ListByCI(ctx context.Context, tenantID, ciID string) ([]models.CIAuditLog, error) {
	var logs []models.CIAuditLog
	err := r.db.SelectContext(ctx, &logs,
		"SELECT * FROM ci_audit_log WHERE tenant_id = $1 AND ci_id = $2 ORDER BY created_at DESC",
		tenantID, ciID)
	return logs, err
}
