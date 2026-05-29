package repository

import (
	"context"
	"orion/notification-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }

func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) CreateNotification(ctx context.Context, n *models.Notification) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO notifications (id, tenant_id, channel, recipient, subject, body, status, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, n.ID, n.TenantID, n.Channel, n.Recipient, n.Subject, n.Body, n.Status, n.Metadata)
	return err
}

func (r *Repository) ListNotifications(ctx context.Context, tenantID string, offset, limit int) ([]models.Notification, error) {
	var items []models.Notification
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM notifications WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetNotification(ctx context.Context, tenantID, id string) (*models.Notification, error) {
	var n models.Notification
	err := r.db.GetContext(ctx, &n, `SELECT * FROM notifications WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &n, nil
}

func (r *Repository) CreateTemplate(ctx context.Context, t *models.NotificationTemplate) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO notification_templates (id, tenant_id, name, channel, subject, body) VALUES ($1,$2,$3,$4,$5,$6)`, t.ID, t.TenantID, t.Name, t.Channel, t.Subject, t.Body)
	return err
}

func (r *Repository) ListTemplates(ctx context.Context, tenantID string) ([]models.NotificationTemplate, error) {
	var items []models.NotificationTemplate
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM notification_templates WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) CreateChannel(ctx context.Context, c *models.NotificationChannel) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO notification_channels (id, tenant_id, name, type, config, enabled) VALUES ($1,$2,$3,$4,$5,$6)`, c.ID, c.TenantID, c.Name, c.Type, c.Config, c.Enabled)
	return err
}

func (r *Repository) ListChannels(ctx context.Context, tenantID string) ([]models.NotificationChannel, error) {
	var items []models.NotificationChannel
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM notification_channels WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}
