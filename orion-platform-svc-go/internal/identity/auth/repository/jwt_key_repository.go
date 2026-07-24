package repository

import (
	"context"
	"database/sql"

	"orion/platform-svc-go/internal/identity/auth/model"
	"orion/go-common/pkg/database"
)

type JwtKeyRepository struct {
	db *database.DB
}

func NewJwtKeyRepository(db *database.DB) *JwtKeyRepository {
	return &JwtKeyRepository{db: db}
}

// Create inserts a new JWT key record.
func (r *JwtKeyRepository) Create(ctx context.Context, key *model.JwtKey) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO jwt_keys (key_id, key_hash, key_strength, status, rotation_type, created_at)
		VALUES (:key_id, :key_hash, :key_strength, :status, :rotation_type, :created_at)
	`, key)
	return err
}

// FindByKeyID returns a JWT key by its key_id.
func (r *JwtKeyRepository) FindByKeyID(ctx context.Context, keyID string) (*model.JwtKey, error) {
	var k model.JwtKey
	err := r.db.GetContext(ctx, &k, "SELECT * FROM jwt_keys WHERE key_id = $1", keyID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &k, err
}

// List returns all JWT keys ordered by creation time descending.
func (r *JwtKeyRepository) List(ctx context.Context) ([]model.JwtKey, error) {
	var keys []model.JwtKey
	err := r.db.SelectContext(ctx, &keys, "SELECT * FROM jwt_keys ORDER BY created_at DESC")
	return keys, err
}

// ListByStatus returns all JWT keys with the given status.
func (r *JwtKeyRepository) ListByStatus(ctx context.Context, status string) ([]model.JwtKey, error) {
	var keys []model.JwtKey
	err := r.db.SelectContext(ctx, &keys, "SELECT * FROM jwt_keys WHERE status = $1 ORDER BY created_at DESC", status)
	return keys, err
}

// Update updates a JWT key's metadata by its key_id.
func (r *JwtKeyRepository) Update(ctx context.Context, key *model.JwtKey) error {
	_, err := r.db.NamedExecContext(ctx, `
		UPDATE jwt_keys SET
			status = :status,
			activated_at = :activated_at,
			expires_at = :expires_at
		WHERE key_id = :key_id
	`, key)
	return err
}

// CountByStatus returns the number of keys with the given status.
func (r *JwtKeyRepository) CountByStatus(ctx context.Context, status string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, "SELECT COUNT(*) FROM jwt_keys WHERE status = $1", status)
	return count, err
}
