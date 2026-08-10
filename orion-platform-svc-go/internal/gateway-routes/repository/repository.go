package repository

import (
    "context"
    "time"

    "orion/platform-svc-go/internal/gateway-routes/models"

    "github.com/google/uuid"
    "github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }

func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, item *models.GatewayRoutesItem) error {
    if r.db == nil { return nil }
    item.ID = uuid.New().String()
    now := time.Now().UTC()
    item.CreatedAt = now
    item.UpdatedAt = now
    _, err := r.db.NamedExecContext(ctx,
        "INSERT INTO gateway-routes (id, tenant_id, name, description, enabled, created_at, updated_at) VALUES (:id, :tenant_id, :name, :description, :enabled, :created_at, :updated_at)", item)
    return err
}

func (r *Repository) Get(ctx context.Context, tenantID, id string) (*models.GatewayRoutesItem, error) {
    if r.db == nil { return nil, nil }
    item := &models.GatewayRoutesItem{}
    return item, r.db.GetContext(ctx, item, "SELECT * FROM gateway-routes WHERE id = $1 AND tenant_id = $2", id, tenantID)
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.GatewayRoutesItem, error) {
    if r.db == nil { return []models.GatewayRoutesItem{}, nil }
    var items []models.GatewayRoutesItem
    return items, r.db.SelectContext(ctx, &items, "SELECT * FROM gateway-routes WHERE tenant_id = $1 ORDER BY created_at DESC", tenantID)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
    if r.db == nil { return nil }
    _, err := r.db.ExecContext(ctx, "DELETE FROM gateway-routes WHERE id = $1 AND tenant_id = $2", id, tenantID)
    return err
}
