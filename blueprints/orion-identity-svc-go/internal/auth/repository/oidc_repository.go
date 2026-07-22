package repository

import (
	"context"
	"database/sql"

	"orion/identity-svc-go/internal/auth/model"
	"orion/go-common/pkg/database"
)

// OIDCRepository handles persistence for OIDC providers and account links.
type OIDCRepository struct {
	db *database.DB
}

// NewOIDCRepository creates a new OIDCRepository.
func NewOIDCRepository(db *database.DB) *OIDCRepository {
	return &OIDCRepository{db: db}
}

// DB returns the wrapped database handle.
func (r *OIDCRepository) DB() *database.DB { return r.db }

// --- oidc_providers ---

func (r *OIDCRepository) CreateProvider(ctx context.Context, p *model.OIDCProvider) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO oidc_providers (id, tenant_id, name, display_name, issuer_url, client_id, client_secret_encrypted, redirect_uri, scopes, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :display_name, :issuer_url, :client_id, :client_secret_encrypted, :redirect_uri, :scopes, :enabled, :created_at, :updated_at)
	`, p)
	return err
}

func (r *OIDCRepository) GetProviderByID(ctx context.Context, id string) (*model.OIDCProvider, error) {
	var p model.OIDCProvider
	err := r.db.GetContext(ctx, &p, "SELECT * FROM oidc_providers WHERE id = $1", id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &p, err
}

func (r *OIDCRepository) GetProviderByTenantAndName(ctx context.Context, tenantID, name string) (*model.OIDCProvider, error) {
	var p model.OIDCProvider
	err := r.db.GetContext(ctx, &p, "SELECT * FROM oidc_providers WHERE tenant_id = $1 AND name = $2", tenantID, name)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &p, err
}

func (r *OIDCRepository) ListProviders(ctx context.Context, tenantID string) ([]model.OIDCProvider, error) {
	var ps []model.OIDCProvider
	err := r.db.SelectContext(ctx, &ps, "SELECT * FROM oidc_providers WHERE tenant_id = $1 ORDER BY name", tenantID)
	return ps, err
}

func (r *OIDCRepository) UpdateProvider(ctx context.Context, p *model.OIDCProvider) error {
	_, err := r.db.NamedExecContext(ctx, `
		UPDATE oidc_providers SET display_name = :display_name, issuer_url = :issuer_url, client_id = :client_id,
		client_secret_encrypted = :client_secret_encrypted, redirect_uri = :redirect_uri, scopes = :scopes,
		enabled = :enabled, updated_at = :updated_at WHERE id = :id
	`, p)
	return err
}

func (r *OIDCRepository) DeleteProvider(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM oidc_providers WHERE id = $1", id)
	return err
}

// --- user_oidc_links ---

func (r *OIDCRepository) CreateLink(ctx context.Context, l *model.UserOIDCLink) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO user_oidc_links (id, tenant_id, provider_name, subject, user_id, email, name, groups, roles, last_login_at, created_at, updated_at)
		VALUES (:id, :tenant_id, :provider_name, :subject, :user_id, :email, :name, :groups, :roles, :last_login_at, :created_at, :updated_at)
	`, l)
	return err
}

func (r *OIDCRepository) GetLinkBySubject(ctx context.Context, tenantID, provider, subject string) (*model.UserOIDCLink, error) {
	var l model.UserOIDCLink
	err := r.db.GetContext(ctx, &l, "SELECT * FROM user_oidc_links WHERE tenant_id = $1 AND provider_name = $2 AND subject = $3", tenantID, provider, subject)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &l, err
}

func (r *OIDCRepository) GetLinkByUserID(ctx context.Context, tenantID, userID string) ([]model.UserOIDCLink, error) {
	var ls []model.UserOIDCLink
	err := r.db.SelectContext(ctx, &ls, "SELECT * FROM user_oidc_links WHERE tenant_id = $1 AND user_id = $2", tenantID, userID)
	return ls, err
}

func (r *OIDCRepository) DeleteLink(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM user_oidc_links WHERE id = $1", id)
	return err
}

func (r *OIDCRepository) TouchLinkLastLogin(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE user_oidc_links SET last_login_at = now(), updated_at = now() WHERE id = $1", id)
	return err
}

// --- sso_states ---

func (r *OIDCRepository) CreateSSOState(ctx context.Context, s *model.SSOState) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO sso_states (id, tenant_id, state, provider_name, data, expires_at, created_at)
		VALUES (:id, :tenant_id, :state, :provider_name, :data, :expires_at, :created_at)
	`, s)
	return err
}

func (r *OIDCRepository) GetSSOState(ctx context.Context, tenantID, state string) (*model.SSOState, error) {
	var s model.SSOState
	err := r.db.GetContext(ctx, &s, "SELECT * FROM sso_states WHERE tenant_id = $1 AND state = $2 AND expires_at > now()", tenantID, state)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &s, err
}

func (r *OIDCRepository) DeleteSSOState(ctx context.Context, tenantID, state string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM sso_states WHERE tenant_id = $1 AND state = $2", tenantID, state)
	return err
}
