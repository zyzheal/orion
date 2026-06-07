package repository

import (
	"context"
	"fmt"

	"orion/secret-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides data access for the secrets table.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new secret. Uses ON CONFLICT for upsert semantics.
func (r *Repository) Create(ctx context.Context, s *models.Secret) error {
	query := `
		INSERT INTO secrets (id, tenant_id, name, value_encrypted, scope, description, created_by, version, environment)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (tenant_id, name, scope)
		DO UPDATE SET value_encrypted = $4, description = $6, updated_at = NOW()
	`
	_, err := r.db.ExecContext(ctx, query,
		s.ID, s.TenantID, s.Name, s.Value, s.Scope, s.Description, s.CreatedBy, s.Version, s.Env,
	)
	return err
}

// List returns paginated secrets for a tenant (value columns excluded from SELECT).
func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Secret, error) {
	var items []models.Secret
	query := `SELECT id, tenant_id, name, scope, description, created_by, version, environment, created_at, updated_at
		FROM secrets WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`
	err := r.db.SelectContext(ctx, &items, query, tenantID, offset, limit)
	return items, err
}

// ListByScope returns secrets filtered by tenant and scope.
func (r *Repository) ListByScope(ctx context.Context, tenantID string, scope models.SecretScope) ([]models.Secret, error) {
	var items []models.Secret
	query := `SELECT id, tenant_id, name, scope, description, created_by, version, environment, created_at, updated_at
		FROM secrets WHERE tenant_id=$1 AND scope=$2 ORDER BY name ASC`
	err := r.db.SelectContext(ctx, &items, query, tenantID, scope)
	return items, err
}

// GetByID returns a secret by tenant and ID, including the encrypted value.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Secret, error) {
	var s models.Secret
	err := r.db.GetContext(ctx, &s, `SELECT * FROM secrets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("secret not found: %w", err)
	}
	return &s, nil
}

// FindByID returns a secret by ID without tenant filter.
// DEPRECATED: Use GetByID with tenantID instead. Retained only for cross-service
// internal calls where tenant context is not available.
func (r *Repository) FindByID(ctx context.Context, id string) (*models.Secret, error) {
	var s models.Secret
	err := r.db.GetContext(ctx, &s, `SELECT * FROM secrets WHERE id=$1`, id)
	if err != nil {
		return nil, fmt.Errorf("secret not found: %w", err)
	}
	return &s, nil
}

// FindByTenantAndName finds a secret by tenant and name, optionally filtered by scope.
// When scope is empty, searches across all scopes with priority: project > environment > org.
func (r *Repository) FindByTenantAndName(ctx context.Context, tenantID, name string, scope models.SecretScope) (*models.Secret, error) {
	if scope != "" {
		var s models.Secret
		err := r.db.GetContext(ctx, &s,
			`SELECT * FROM secrets WHERE tenant_id=$1 AND name=$2 AND scope=$3`,
			tenantID, name, scope,
		)
		if err != nil {
			return nil, fmt.Errorf("secret not found: %w", err)
		}
		return &s, nil
	}

	// Without scope, search across all scopes with priority ordering
	var s models.Secret
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM secrets WHERE tenant_id=$1 AND name=$2
		 ORDER BY CASE scope WHEN 'project' THEN 1 WHEN 'environment' THEN 2 WHEN 'org' THEN 3 END
		 LIMIT 1`,
		tenantID, name,
	)
	if err != nil {
		return nil, fmt.Errorf("secret not found: %w", err)
	}
	return &s, nil
}

// Delete removes a secret by tenant and ID.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM secrets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// DeleteByID removes a secret by ID only.
// DEPRECATED: Use Delete with tenantID instead. Retained only for cross-service
// internal calls where tenant context is not available.
func (r *Repository) DeleteByID(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM secrets WHERE id=$1`, id)
	return err
}

// DeleteByTenantAndScope removes all secrets for a tenant and scope.
func (r *Repository) DeleteByTenantAndScope(ctx context.Context, tenantID string, scope models.SecretScope) (int64, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM secrets WHERE tenant_id=$1 AND scope=$2`, tenantID, scope)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// Count returns the total number of secrets for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM secrets WHERE tenant_id=$1`, tenantID)
	return count, err
}

// UpdateValue updates the encrypted value of a secret, scoped to tenant.
func (r *Repository) UpdateValue(ctx context.Context, tenantID, id, encryptedValue string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE secrets SET value_encrypted=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		encryptedValue, id, tenantID,
	)
	return err
}

// UpdateDescription updates the description of a secret, scoped to tenant.
func (r *Repository) UpdateDescription(ctx context.Context, tenantID, id string, description *string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE secrets SET description=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		description, id, tenantID,
	)
	return err
}
