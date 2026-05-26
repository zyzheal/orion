package repository

import (
	"context"
	"fmt"

	"orion/auth-svc/internal/models"

	"github.com/jmoiron/sqlx"
)

// BlacklistRepository provides data access for token blacklist entries.
type BlacklistRepository struct {
	db *sqlx.DB
}

func NewBlacklistRepository(db *sqlx.DB) *BlacklistRepository {
	return &BlacklistRepository{db: db}
}

func (r *BlacklistRepository) Create(ctx context.Context, entry *models.TokenBlacklist) error {
	query := `
		INSERT INTO token_blacklist (token_jti, token_type, expires_at)
		VALUES ($1, $2, $3) RETURNING id, created_at
	`
	err := r.db.QueryRowContext(ctx, query,
		entry.TokenJTI, entry.TokenType, entry.ExpiresAt,
	).Scan(&entry.ID, &entry.CreatedAt)
	return err
}

func (r *BlacklistRepository) GetByJTI(ctx context.Context, jti string) (*models.TokenBlacklist, error) {
	var entry models.TokenBlacklist
	query := `SELECT id, token_jti, token_type, expires_at, created_at FROM token_blacklist WHERE token_jti = $1`
	err := r.db.GetContext(ctx, &entry, query, jti)
	if err != nil {
		return nil, fmt.Errorf("blacklist entry not found: %w", err)
	}
	return &entry, nil
}

func (r *BlacklistRepository) IsBlacklisted(ctx context.Context, jti string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		"SELECT EXISTS(SELECT 1 FROM token_blacklist WHERE token_jti = $1 AND expires_at > now())", jti)
	return exists, err
}

func (r *BlacklistRepository) Delete(ctx context.Context, id int64) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM token_blacklist WHERE id = $1", id)
	return err
}

func (r *BlacklistRepository) CleanupExpired(ctx context.Context) (int64, error) {
	result, err := r.db.ExecContext(ctx, "DELETE FROM token_blacklist WHERE expires_at < now()")
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
