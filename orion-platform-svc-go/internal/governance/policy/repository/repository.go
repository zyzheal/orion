package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/platform-svc-go/internal/dbupdate"
	"orion/platform-svc-go/internal/governance/policy/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, m *models.Policy) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO policy (id, tenant_id, name, created_at, updated_at) VALUES (:id, :tenant_id, :name, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Policy, error) {
	var m models.Policy
	err := r.db.GetContext(ctx, &m, `SELECT * FROM policy WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.Policy, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Policy
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM policy WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// policyColumns is what Update may write; tenant_id is the key.
var policyColumns = []string{"name"}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if _, err := r.GetByID(ctx, tenantID, id); err != nil {
		return err
	}
	stmt, args, err := dbupdate.Build("policy", updates, policyColumns, id, tenantID)
	if err != nil {
		if errors.Is(err, dbupdate.ErrEmpty) {
			return nil
		}
		return err
	}
	_, err = r.db.ExecContext(ctx, stmt, args...)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM policy WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
