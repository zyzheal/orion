package repository

import (
	"context"
	"database/sql"
	"errors"

	"orion/platform-svc-go/internal/confirmation/models"

	"orion/go-common/pkg/sentinel"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	var records []models.Record
	err := r.db.SelectContext(ctx, &records, "SELECT * FROM confirmations WHERE tenant_id=$1", tenantID)
	return records, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Record, error) {
	var record models.Record
	err := r.db.GetContext(ctx, &record, "SELECT * FROM confirmations WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &record, err
}

func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	return sentinel.NotFound
}
