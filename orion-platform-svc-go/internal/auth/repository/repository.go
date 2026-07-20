package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/platform-svc-go/internal/auth/models"

	"github.com/jmoiron/sqlx"
)

var errNotFound = errors.New("refresh token not found")

// Repository provides PostgreSQL-backed persistence for refresh tokens.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new refresh token.
func (r *Repository) Create(ctx context.Context, rt *models.RefreshToken) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, tenant_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		rt.ID, rt.UserID, rt.TokenHash, rt.ExpiresAt, rt.TenantID, rt.CreatedAt,
	)
	return err
}

// FindByHash retrieves a refresh token by its SHA-256 hash (joined with users for status check).
type RefreshTokenRow struct {
	models.RefreshToken
	Username string `db:"username"`
	Role     string `db:"role"`
	Status   string `db:"status"`
}

func (r *Repository) FindByHash(ctx context.Context, tokenHash string) (*RefreshTokenRow, error) {
	var row RefreshTokenRow
	err := r.db.GetContext(ctx, &row, `
		SELECT rt.id, rt.user_id, rt.token_hash, rt.expires_at, rt.tenant_id, rt.created_at,
		       u.username, u.role, u.status
		FROM refresh_tokens rt
		JOIN users u ON u.id = rt.user_id
		WHERE rt.token_hash = $1 AND rt.expires_at > NOW()`, tokenHash)
	if err == sql.ErrNoRows {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

// DeleteByHash removes a refresh token by its hash.
func (r *Repository) DeleteByHash(ctx context.Context, tokenHash string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM refresh_tokens WHERE token_hash = $1`, tokenHash)
	return err
}

// DeleteByUserID removes all refresh tokens for a user (used for full logout).
func (r *Repository) DeleteByUserID(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM refresh_tokens WHERE user_id = $1`, userID)
	return err
}

// CleanupExpired removes all expired refresh tokens.
func (r *Repository) CleanupExpired(ctx context.Context) (int64, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM refresh_tokens WHERE expires_at < NOW()`)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// FindTenantsByUserID retrieves tenant IDs for a user.
func (r *Repository) FindTenantsByUserID(ctx context.Context, userID string) ([]string, error) {
	var tenants []string
	err := r.db.SelectContext(ctx, &tenants,
		`SELECT tenant_id FROM tenant_users WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	return tenants, nil
}

// IsExpired checks if a given time is past the expiry.
func IsExpired(expiresAt time.Time) bool {
	return time.Now().After(expiresAt)
}
