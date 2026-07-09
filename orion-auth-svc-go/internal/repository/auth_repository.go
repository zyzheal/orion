package repository

import (
	"context"
	"database/sql"

	"orion/auth-svc-go/internal/model"
	"orion/go-common/pkg/database"
)

type AuthRepository struct {
	db *database.DB
}

func NewAuthRepository(db *database.DB) *AuthRepository {
	return &AuthRepository{db: db}
}

func (r *AuthRepository) DB() *database.DB { return r.db }

func (r *AuthRepository) FindUserByID(ctx context.Context, id string) (*model.User, error) {
	var u model.User
	err := r.db.GetContext(ctx, &u, "SELECT * FROM users WHERE id = $1", id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &u, err
}

func (r *AuthRepository) FindUserByUsername(ctx context.Context, tenantID, username string) (*model.User, error) {
	var u model.User
	err := r.db.GetContext(ctx, &u, "SELECT * FROM users WHERE tenant_id = $1 AND username = $2", tenantID, username)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &u, err
}

func (r *AuthRepository) CreateUser(ctx context.Context, u *model.User) error {
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO users (id, tenant_id, username, email, password_hash, status, created_at, updated_at) VALUES (:id, :tenant_id, :username, :email, :password_hash, :status, :created_at, :updated_at)`, u)
	return err
}

func (r *AuthRepository) UpdateUser(ctx context.Context, u *model.User) error {
	_, err := r.db.NamedExecContext(ctx, `UPDATE users SET username = :username, email = :email, status = :status, updated_at = :updated_at WHERE id = :id`, u)
	return err
}

func (r *AuthRepository) SaveRefreshToken(ctx context.Context, t *model.RefreshToken) error {
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (:id, :user_id, :token_hash, :expires_at, :created_at)`, t)
	return err
}

func (r *AuthRepository) FindValidRefreshToken(ctx context.Context, userID, tokenHash string) (*model.RefreshToken, error) {
	var t model.RefreshToken
	err := r.db.GetContext(ctx, &t, "SELECT * FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > now() AND revoked_at IS NULL", userID, tokenHash)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &t, err
}

func (r *AuthRepository) RevokeRefreshToken(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1", id)
	return err
}

func (r *AuthRepository) RecordLoginAttempt(ctx context.Context, a *model.LoginAttempt) error {
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO login_attempts (id, tenant_id, username, success, ip_address, user_agent, created_at) VALUES (:id, :tenant_id, :username, :success, :ip_address, :user_agent, :created_at)`, a)
	return err
}

func (r *AuthRepository) ListPermissions(ctx context.Context, tenantID string) ([]model.Permission, error) {
	var perms []model.Permission
	err := r.db.SelectContext(ctx, &perms, "SELECT * FROM permissions WHERE tenant_id = $1", tenantID)
	return perms, err
}

func (r *AuthRepository) InsertAuditLog(ctx context.Context, log *model.AuditLog) error {
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO audit_logs (id, tenant_id, actor_id, action, resource, resource_id, details, ip_address, created_at) VALUES (:id, :tenant_id, :actor_id, :action, :resource, :resource_id, :details, :ip_address, :created_at)`, log)
	return err
}

func (r *AuthRepository) FindPermissionByID(ctx context.Context, id string) (*model.Permission, error) {
	var p model.Permission
	err := r.db.GetContext(ctx, &p, "SELECT * FROM permissions WHERE id = $1", id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &p, err
}

func (r *AuthRepository) FindRefreshTokenByHash(ctx context.Context, tokenHash string) (*model.RefreshToken, error) {
	var t model.RefreshToken
	err := r.db.GetContext(ctx, "SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > now() AND revoked_at IS NULL", tokenHash)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &t, err
}
