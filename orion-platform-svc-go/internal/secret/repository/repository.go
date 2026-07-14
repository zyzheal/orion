package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/secret/models"

	"github.com/jmoiron/sqlx"
)

var errNotFound = errors.New("secret not found")

// Repository provides PostgreSQL-backed persistence for secrets.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new secret row.
func (r *Repository) Create(ctx context.Context, s *models.Secret) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO secrets (id, tenant_id, name, encrypted_value, scope, description, created_at, updated_at, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		s.ID, s.TenantID, s.Name, s.EncryptedValue, s.Scope, s.Description,
		s.CreatedAt, s.UpdatedAt, s.CreatedBy,
	)
	return err
}

// GetByID retrieves a single secret by id.
func (r *Repository) GetByID(ctx context.Context, id string) (*models.Secret, error) {
	var s models.Secret
	err := r.db.GetContext(ctx, &s, `SELECT * FROM secrets WHERE id=$1`, id)
	if err == sql.ErrNoRows {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// GetByTenantAndName finds a secret by tenant, name, and optional scope.
// When scope is empty, it searches across all scopes (priority: project > environment > org).
func (r *Repository) GetByTenantAndName(ctx context.Context, tenantID, name, scope string) (*models.Secret, error) {
	var s models.Secret
	if scope != "" {
		err := r.db.GetContext(ctx, &s, `SELECT * FROM secrets WHERE tenant_id=$1 AND name=$2 AND scope=$3`, tenantID, name, scope)
		if err == sql.ErrNoRows {
			return nil, errNotFound
		}
		if err != nil {
			return nil, err
		}
		return &s, nil
	}
	// Scope not specified: priority order project > environment > org
	err := r.db.GetContext(ctx, &s, `
		SELECT * FROM secrets WHERE tenant_id=$1 AND name=$2
		ORDER BY CASE scope WHEN 'project' THEN 1 WHEN 'environment' THEN 2 WHEN 'org' THEN 3 END
		LIMIT 1`,
		tenantID, name,
	)
	if err == sql.ErrNoRows {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// List retrieves secrets for a tenant with optional scope filter.
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter) ([]models.Secret, error) {
	var items []models.Secret

	query := "SELECT * FROM secrets WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil && filter.Scope != nil {
		query += fmt.Sprintf(" AND scope=$%d", argIdx)
		args = append(args, *filter.Scope)
		argIdx++
	}

	query += " ORDER BY scope, name ASC"

	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// UpdateValue updates the encrypted_value and updated_at for a secret.
func (r *Repository) UpdateValue(ctx context.Context, id string, encryptedValue []byte) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE secrets SET encrypted_value=$1, updated_at=NOW() WHERE id=$2`,
		encryptedValue, id)
	return err
}

// UpdateDescription updates the description and updated_at for a secret.
func (r *Repository) UpdateDescription(ctx context.Context, id string, description string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE secrets SET description=$1, updated_at=NOW() WHERE id=$2`,
		description, id)
	return err
}

// Delete removes a secret by id.
func (r *Repository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM secrets WHERE id=$1`, id)
	return err
}
