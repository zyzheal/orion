package repository

import (
	"context"
	"orion/chatops-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, d *models.ChatChannel) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO chat_channels (id, tenant_id, name, channel, command, response, platform, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, d.ID, d.TenantID, d.Name, d.Channel, d.Command, d.Response, d.Platform, d.Metadata)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.ChatChannel, error) {
	var items []models.ChatChannel
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM chat_channels WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ChatChannel, error) {
	var d models.ChatChannel
	err := r.db.GetContext(ctx, &d, `SELECT * FROM chat_channels WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &d, nil
}

func (r *Repository) Update(ctx context.Context, d *models.ChatChannel) error {
	_, err := r.db.ExecContext(ctx, `UPDATE chat_channels SET name=$1, channel=$2, command=$3, response=$4, platform=$5, metadata=$6 WHERE id=$7 AND tenant_id=$8`, d.Name, d.Channel, d.Command, d.Response, d.Platform, d.Metadata, d.ID, d.TenantID)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM chat_channels WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM chat_channels WHERE tenant_id=$1`, tenantID)
	return count, err
}
