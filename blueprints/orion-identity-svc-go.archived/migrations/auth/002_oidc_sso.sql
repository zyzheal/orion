-- Migration: Create OIDC SSO tables for orion-auth-svc-go
-- Supports multi-tenant OIDC provider management + account linking

-- oidc_providers table: stores OIDC provider configuration
CREATE TABLE IF NOT EXISTS oidc_providers (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    display_name VARCHAR(128) NOT NULL,
    issuer_url TEXT NOT NULL,
    client_id VARCHAR(256) NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    scopes VARCHAR(512) DEFAULT 'openid email profile',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_oidc_providers_tenant ON oidc_providers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oidc_providers_enabled ON oidc_providers(enabled);

-- user_oidc_links table: links OIDC identities to Orion users
CREATE TABLE IF NOT EXISTS user_oidc_links (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    provider_name VARCHAR(128) NOT NULL,
    subject VARCHAR(256) NOT NULL,          -- OIDC subject claim (sub)
    user_id VARCHAR(128) NOT NULL,
    email VARCHAR(256),
    name VARCHAR(256),
    groups TEXT,                            -- JSON array of groups
    roles TEXT,                             -- JSON array of roles
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, provider_name, subject)
);

CREATE INDEX IF NOT EXISTS idx_user_oidc_links_user ON user_oidc_links(user_id);
CREATE INDEX IF NOT EXISTS idx_user_oidc_links_provider ON user_oidc_links(tenant_id, provider_name);
CREATE INDEX IF NOT EXISTS idx_user_oidc_links_tenant ON user_oidc_links(tenant_id);

-- sso_states table: transient state for OAuth2 code flow (state/nonce pairing)
CREATE TABLE IF NOT EXISTS sso_states (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    state VARCHAR(256) NOT NULL,
    provider_name VARCHAR(128) NOT NULL,
    data TEXT NOT NULL,                     -- JSON blob: nonce, scopes, etc.
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, provider_name, state)
);

CREATE INDEX IF NOT EXISTS idx_sso_states_expires ON sso_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_sso_states_tenant_state ON sso_states(tenant_id, state);

-- Audit log table extension (ensure column exists for SSO actions)
-- audit_logs table is defined by the auth service's own migration; this is a no-op guard
ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS method VARCHAR(16) DEFAULT 'local';
