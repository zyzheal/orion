package repository

import (
	"orion-cmdb-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type CIAuditRepository struct {
	db *sqlx.DB
}

func NewCIAuditRepository(db *sqlx.DB) *CIAuditRepository {
	return &CIAuditRepository{db: db}
}

func (r *CIAuditRepository) Create(log *models.CIAuditLog) error {
	query := `INSERT INTO ci_audit_log (id, tenant_id, ci_id, action, actor, old_value, new_value)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.Exec(query,
		log.ID, log.TenantID, log.CIID, log.Action, log.Actor, log.OldValue, log.NewValue,
	)
	return err
}

func (r *CIAuditRepository) ListByCI(tenantID, ciID string) ([]models.CIAuditLog, error) {
	var logs []models.CIAuditLog
	err := r.db.Select(&logs,
		"SELECT * FROM ci_audit_log WHERE tenant_id = $1 AND ci_id = $2 ORDER BY created_at DESC",
		tenantID, ciID)
	return logs, err
}
