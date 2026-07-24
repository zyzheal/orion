package repository

import (
	"context"
	"database/sql"
	"errors"

	"orion/platform-svc-go/internal/application/models"

	"github.com/jmoiron/sqlx"
)

var errNotFound = errors.New("application not found")

// Repository provides PostgreSQL-backed persistence for applications.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new application row.
func (r *Repository) Create(ctx context.Context, a *models.Application) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO applications (id, name, tenant_id, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5)`,
		a.ID, a.Name, a.TenantID, a.CreatedAt, a.UpdatedAt,
	)
	return err
}

// GetByID retrieves a single application by id and tenant_id.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Application, error) {
	var a models.Application
	err := r.db.GetContext(ctx, &a,
		`SELECT * FROM applications WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err == sql.ErrNoRows {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// List retrieves applications for a tenant with optional name filter.
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Application, error) {
	var items []models.Application

	query := "SELECT * FROM applications WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil && filter.Name != nil {
		query += " AND name ILIKE $" + string(rune(argIdx+'0'))
		args = append(args, "%"+*filter.Name+"%")
		argIdx++
	}

	query += " ORDER BY created_at DESC LIMIT $2 OFFSET $1"
	args = append(args, offset, limit)

	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// Update updates an application's name.
func (r *Repository) Update(ctx context.Context, a *models.Application) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE applications SET name=$1, updated_at=NOW()
		WHERE id=$2 AND tenant_id=$3`,
		a.Name, a.ID, a.TenantID,
	)
	return err
}

// Delete removes an application by id and tenant_id.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM applications WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
