package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/api-key/models"

	"github.com/jmoiron/sqlx"
)

var errNotFound = errors.New("api key not found")

// Repository provides PostgreSQL-backed persistence for API keys.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new API key row.
func (r *Repository) Create(ctx context.Context, key *models.APIKey) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO api_keys (
			id, name, key_hash, last_used_at, expires_at, scope,
			tenant_id, user_id, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		key.ID, key.Name, key.KeyHash, key.LastUsedAt, key.ExpiresAt, key.Scope,
		key.TenantID, key.UserID, key.CreatedAt, key.UpdatedAt,
	)
	return err
}

// GetByID retrieves a single API key by id and tenant_id.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.APIKey, error) {
	var k models.APIKey
	err := r.db.GetContext(ctx, &k,
		`SELECT * FROM api_keys WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err == sql.ErrNoRows {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	return &k, nil
}

// GetByHash verifies an API key by its SHA-256 hash and tenant_id.
func (r *Repository) GetByHash(ctx context.Context, tenantID, keyHash string) (*models.APIKey, error) {
	var k models.APIKey
	err := r.db.GetContext(ctx, &k,
		`SELECT * FROM api_keys WHERE key_hash=$1 AND tenant_id=$2`, keyHash, tenantID)
	if err == sql.ErrNoRows {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	return &k, nil
}

// List retrieves API keys for a tenant with optional filters and pagination.
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.APIKey, error) {
	var items []models.APIKey

	query := "SELECT * FROM api_keys WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.UserID != nil {
			query += fmt.Sprintf(" AND user_id=$%d", argIdx)
			args = append(args, *filter.UserID)
			argIdx++
		}
		if filter.Status != nil {
			switch *filter.Status {
			case "expired":
				_ = argIdx // not consumed, inline in query
				query += " AND (expires_at IS NOT NULL AND expires_at < NOW())"
			case "active":
				_ = argIdx
				query += " AND (expires_at IS NULL OR expires_at > NOW())"
			}
		}
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC OFFSET $%d LIMIT $%d", argIdx, argIdx+1)
	args = append(args, offset, limit)

	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// Count returns the total number of API keys for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM api_keys WHERE tenant_id=$1`, tenantID)
	return count, err
}

// CountByUser returns the number of active API keys for a specific user.
func (r *Repository) CountByUser(ctx context.Context, tenantID, userID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `
		SELECT COUNT(*) FROM api_keys
		WHERE tenant_id=$1 AND user_id=$2 AND (expires_at IS NULL OR expires_at > NOW())`,
		tenantID, userID)
	return count, err
}

// UpdateLastUsed records the last usage time for a key.
func (r *Repository) UpdateLastUsed(ctx context.Context, id string, tenantID string, usedAt interface{}) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE api_keys SET last_used_at=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		usedAt, id, tenantID)
	return err
}

// Delete removes an API key by id and tenant_id.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM api_keys WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
