package repository

import (
	"context"
	"orion/audit-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, a *models.AuditLog) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO audit_logs (id, tenant_id, action, resource_type, resource_id, actor_id, actor_name, details, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, a.ID, a.TenantID, a.Action, a.ResourceType, a.ResourceID, a.ActorID, a.ActorName, a.Details, a.IPAddress)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.AuditLog, error) {
	var items []models.AuditLog
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM audit_logs WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}
