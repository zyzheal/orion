package repository

import (
	"context"

	"orion/notify-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides access to the notify_templates table.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new notify template.
func (r *Repository) Create(ctx context.Context, d *models.NotifyTemplate) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO notify_templates (id, tenant_id, name, channel, recipient, subject, body, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		d.ID, d.TenantID, d.Name, d.Channel, d.Recipient, d.Subject, d.Body, d.Status)
	return err
}

// List returns paginated notify templates for a tenant.
func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.NotifyTemplate, error) {
	var items []models.NotifyTemplate
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM notify_templates WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

// GetByID returns a single notify template by ID and tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.NotifyTemplate, error) {
	var d models.NotifyTemplate
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM notify_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// Delete removes a notify template by ID and tenant.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM notify_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// Count returns the total number of notify templates for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM notify_templates WHERE tenant_id=$1`, tenantID)
	return count, err
}
