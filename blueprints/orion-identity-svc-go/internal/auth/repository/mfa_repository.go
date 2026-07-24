package repository

import (
	"context"
	"database/sql"

	"orion/identity-svc-go/internal/auth/model"
)

// FindMfaByUserID returns the MfaConfig for a user, or nil if not found.
func (r *AuthRepository) FindMfaByUserID(ctx context.Context, userID string) (*model.MfaConfig, error) {
	var m model.MfaConfig
	err := r.db.GetContext(ctx, &m, "SELECT * FROM mfa_configs WHERE user_id = $1", userID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &m, err
}

// UpsertMfaConfig inserts or updates an MFA config row for a user.
func (r *AuthRepository) UpsertMfaConfig(ctx context.Context, m *model.MfaConfig) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO mfa_configs (id, user_id, tenant_id, type, secret, enabled, created_at, updated_at)
		VALUES (:id, :user_id, :tenant_id, :type, :secret, :enabled, :created_at, :updated_at)
		ON CONFLICT (user_id) DO UPDATE SET
			type = EXCLUDED.type,
			secret = EXCLUDED.secret,
			enabled = EXCLUDED.enabled,
			updated_at = EXCLUDED.updated_at
	`, m)
	return err
}

// DisableMfa clears the MFA config for a user.
func (r *AuthRepository) DisableMfa(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE mfa_configs SET enabled = false, secret = '', updated_at = now() WHERE user_id = $1", userID)
	return err
}
