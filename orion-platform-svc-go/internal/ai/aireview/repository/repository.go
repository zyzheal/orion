package repository

import (
	"context"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/google/uuid"
	"orion/platform-svc-go/internal/ai/aireview/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, m *models.AIReview) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO ai_reviews (id, tenant_id, name, created_at, updated_at) VALUES (:id, :tenant_id, :name, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.AIReview, error) {
	var items []models.AIReview
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM ai_reviews WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}
