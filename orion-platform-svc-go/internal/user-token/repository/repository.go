package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/platform-svc-go/internal/user-token/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, tenantID, userID string, name string, expiresAt *time.Time) (*models.Token, error) {
	now := time.Now().UTC()
	token := &models.Token{
		ID:        uuid.New().String(),
		UserID:    userID,
		Name:      name,
		TokenHash: uuid.New().String(), // Hash of the actual token
		ExpiresAt: expiresAt,
		CreatedAt: now,
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO user_tokens (id, tenant_id, user_id, name, token_hash, expires_at, created_at) VALUES (:id, :tenantId, :userId, :name, :tokenHash, :expiresAt, :createdAt)`,
		token)
	return token, err
}

func (r *Repository) ListByUserID(ctx context.Context, tenantID, userID string) ([]models.Token, error) {
	var tokens []models.Token
	err := r.db.SelectContext(ctx, &tokens,
		`SELECT * FROM user_tokens WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC`,
		tenantID, userID)
	return tokens, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Token, error) {
	var token models.Token
	err := r.db.GetContext(ctx, &token,
		`SELECT * FROM user_tokens WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &token, nil
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM user_tokens WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

func (r *Repository) EnsureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS user_tokens (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id VARCHAR(255) NOT NULL,
			user_id VARCHAR(255) NOT NULL,
			name VARCHAR(255) NOT NULL,
			token_hash VARCHAR(255) NOT NULL,
			expires_at TIMESTAMP WITH TIME ZONE,
			last_used_at TIMESTAMP WITH TIME ZONE,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL
		)
	`)
	return err
}
