package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/auth-enhanced/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Keys
func (r *Repository) CreateKey(ctx context.Context, key *models.AuthKey) error {
	key.ID = uuid.New().String()
	key.CreatedAt = time.Now().UTC()

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO auth_keys (id, tenant_id, key_id, algorithm, public_key, secret, status, created_at)
		VALUES (:id, :tenantId, :keyId, :algorithm, :publicKey, :secret, :status, :createdAt)
	`, key)
	return err
}

func (r *Repository) GetKeyByID(ctx context.Context, tenantID, id string) (*models.AuthKey, error) {
	var key models.AuthKey
	err := r.db.GetContext(ctx, &key, `SELECT * FROM auth_keys WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &key, nil
}

func (r *Repository) ListKeys(ctx context.Context, tenantID string, status *string) ([]models.AuthKey, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if status != nil {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *status)
		argIdx++
	}

	var keys []models.AuthKey
	err := r.db.SelectContext(ctx, &keys, fmt.Sprintf(`SELECT * FROM auth_keys %s ORDER BY created_at DESC`, where), args...)
	return keys, err
}

func (r *Repository) UpdateKeyStatus(ctx context.Context, tenantID, id, status string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE auth_keys SET status = $1 WHERE id = $2 AND tenant_id = $3`, status, id, tenantID)
	return err
}

func (r *Repository) DeleteKey(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM auth_keys WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// Blacklist
func (r *Repository) CreateBlacklist(ctx context.Context, bl *models.AuthTokenBlacklist) error {
	bl.ID = uuid.New().String()
	bl.CreatedAt = time.Now().UTC()

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO auth_token_blacklist (id, tenant_id, token_id, expires_at, reason, created_at)
		VALUES (:id, :tenantId, :tokenId, :expiresAt, :reason, :createdAt)
	`, bl)
	return err
}

func (r *Repository) IsBlacklisted(ctx context.Context, tenantID, tokenID string) (bool, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `
		SELECT COUNT(*) FROM auth_token_blacklist 
		WHERE tenant_id = $1 AND token_id = $2 AND expires_at > NOW()
	`, tenantID, tokenID)
	return count > 0, err
}

func (r *Repository) ListBlacklist(ctx context.Context, tenantID string) ([]models.AuthTokenBlacklist, error) {
	var blacklist []models.AuthTokenBlacklist
	err := r.db.SelectContext(ctx, &blacklist, `
		SELECT * FROM auth_token_blacklist WHERE tenant_id = $1 AND expires_at > NOW() ORDER BY created_at DESC
	`, tenantID)
	return blacklist, err
}

func (r *Repository) DeleteBlacklist(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM auth_token_blacklist WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}
