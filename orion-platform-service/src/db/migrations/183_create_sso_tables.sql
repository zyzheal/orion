-- Migration: 183_create_sso_tables.sql
-- Purpose: Create tables for SSO (Single Sign-On) support
-- - sso_providers: Configuration for authentication providers (OIDC, LDAP, WeChat, CAS, SAML)
-- - user_sso_bindings: Link local users to external SSO accounts
-- - sso_states: OAuth state storage for CSRF protection

-- SSO Provider Configuration Table
CREATE TABLE IF NOT EXISTS sso_providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(50) NOT NULL UNIQUE,
    type            VARCHAR(20) NOT NULL,  -- "oidc", "ldap", "wechat", "cas", "saml"
    enabled         BOOLEAN DEFAULT true,
    display_name    VARCHAR(100),
    display_icon    VARCHAR(200),
    config          JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- User SSO Bindings Table (one user can bind multiple SSO accounts)
CREATE TABLE IF NOT EXISTS user_sso_bindings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    provider        VARCHAR(50) NOT NULL,
    sso_sub         VARCHAR(255) NOT NULL,  -- OIDC sub / LDAP uid / WeChat userid
    sso_email       VARCHAR(255),
    sso_name        VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, sso_sub)
);

CREATE INDEX IF NOT EXISTS idx_user_sso_bindings_user ON user_sso_bindings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sso_bindings_provider ON user_sso_bindings(provider);

-- OAuth State Storage (for CSRF protection during SSO flows)
CREATE TABLE IF NOT EXISTS sso_states (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state           VARCHAR(255) NOT NULL UNIQUE,
    provider        VARCHAR(50) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sso_states_state ON sso_states(state);
CREATE INDEX IF NOT EXISTS idx_sso_states_expires ON sso_states(expires_at);

-- Cleanup expired states periodically
-- Note: This would normally be handled by a scheduled job
DELETE FROM sso_states WHERE expires_at < NOW();

-- Insert default LDAP provider if configured via environment
-- (Actual values should be set via admin UI or config management)
INSERT INTO sso_providers (name, type, enabled, display_name, display_icon, config)
VALUES (
    'ldap',
    'ldap',
    false,  -- disabled by default, enable via admin UI
    'LDAP 登录',
    'lock',
    '{"url": "", "bind_dn": "", "base_dn": "", "user_filter": "(uid={username})"}'
)
ON CONFLICT (name) DO NOTHING;

-- Insert default WeChat Work provider
INSERT INTO sso_providers (name, type, enabled, display_name, display_icon, config)
VALUES (
    'wechat',
    'wechat',
    false,  -- disabled by default, enable via admin UI
    '企业微信登录',
    'wechat',
    '{"corp_id": "", "agent_id": ""}'
)
ON CONFLICT (name) DO NOTHING;

-- Insert default OIDC provider
INSERT INTO sso_providers (name, type, enabled, display_name, display_icon, config)
VALUES (
    'oidc',
    'oidc',
    false,  -- disabled by default, enable via admin UI
    'OIDC 登录',
    'global',
    '{"issuer_url": "", "client_id": "", "scopes": "openid,email,profile"}'
)
ON CONFLICT (name) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE sso_providers IS 'SSO authentication provider configurations';
COMMENT ON TABLE user_sso_bindings IS 'Links local users to external SSO provider accounts';
COMMENT ON TABLE sso_states IS 'OAuth state storage for CSRF protection during SSO flows';
