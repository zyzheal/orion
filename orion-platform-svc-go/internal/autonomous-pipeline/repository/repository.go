package repository

import (
    "context"
    "database/sql"
    "errors"

    "orion/platform-svc-go/internal/autonomous-pipeline/models"

    "github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("autonomous-pipeline not found")

type Repository struct {
    db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
    return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Record, error) {
    var records []models.Record
    err := r.db.SelectContext(ctx, &records, "SELECT * FROM autonomous-pipelines WHERE tenant_id=$1", tenantID)
    return records, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Record, error) {
    var record models.Record
    err := r.db.GetContext(ctx, &record, "SELECT * FROM autonomous-pipelines WHERE id=$1 AND tenant_id=$2", id, tenantID)
    if errors.Is(err, sql.ErrNoRows) {
        return nil, ErrNotFound
    }
    return &record, err
}

func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
    return nil, ErrNotFound
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
    return nil, ErrNotFound
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
    return ErrNotFound
}
