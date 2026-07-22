package repository

import (
	"context"
	"database/sql"
	"errors"

	"orion/platform-svc-go/internal/ai/models"

	"github.com/jmoiron/sqlx"
)

var errNotFound = errors.New("AI model not found")

// Repository provides PostgreSQL-backed persistence for AI models.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new AI model row.
func (r *Repository) Create(ctx context.Context, m *models.AIModel) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO ai_models (id, name, type, tenant_id, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6)`,
		m.ID, m.Name, m.Type, m.TenantID, m.CreatedAt, m.UpdatedAt,
	)
	return err
}

// GetByID retrieves a single AI model by id and tenant_id.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.AIModel, error) {
	var m models.AIModel
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM ai_models WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err == sql.ErrNoRows {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// List retrieves AI models for a tenant with optional type filter.
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.AIModel, error) {
	var items []models.AIModel

	query := "SELECT * FROM ai_models WHERE tenant_id=$1"
	args := []interface{}{tenantID}

	if filter != nil && filter.Type != nil {
		query += " AND type=$2"
		args = append(args, *filter.Type)
		args = append(args, offset, limit)
		query += " ORDER BY created_at DESC LIMIT $3 OFFSET $2"
	} else {
		args = append(args, offset, limit)
		query += " ORDER BY created_at DESC LIMIT $2 OFFSET $1"
	}

	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// Update updates an AI model's name and/or type.
func (r *Repository) Update(ctx context.Context, m *models.AIModel) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE ai_models SET name=$1, type=$2, updated_at=NOW()
		WHERE id=$3 AND tenant_id=$4`,
		m.Name, m.Type, m.ID, m.TenantID,
	)
	return err
}

// Delete removes an AI model by id and tenant_id.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM ai_models WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
