package repository

import (
	"context"
	"orion/graph-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, d *models.GraphNode) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO graph_nodes (id, tenant_id, name, node_type, properties) VALUES ($1,$2,$3, $4, $5)`, d.ID, d.TenantID, d.Name)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.GraphNode, error) {
	var items []models.GraphNode
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM graph_nodes WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.GraphNode, error) {
	var d models.GraphNode
	err := r.db.GetContext(ctx, &d, `SELECT * FROM graph_nodes WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &d, nil
}
