package repository

import (
    "context"
    "errors"

    "github.com/jmoiron/sqlx"
    "orion/platform-svc-go/internal/privacy/models"
)

var ErrNotFound = errors.New("privacy config not found")

type Repository struct {
    db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
    return &Repository{db: db}
}

func (r *Repository) GetConfig(ctx context.Context, tenantID string) (*models.PrivacyConfig, error) {
    return nil, ErrNotFound
}

func (r *Repository) UpdateConfig(ctx context.Context, tenantID string, config *models.PrivacyConfig) error {
    return nil
}
