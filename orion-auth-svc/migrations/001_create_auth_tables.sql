-- Migration 001: Auth service tables

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    username      VARCHAR(100),
    email         VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role          VARCHAR(50) NOT NULL DEFAULT 'user',
    status        VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id     UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    token         VARCHAR(500) NOT NULL UNIQUE,
    ip_address    INET,
    user_agent    TEXT,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id);

-- Token blacklist table (for logout and token revocation)
CREATE TABLE IF NOT EXISTS token_blacklist (
    id          BIGSERIAL PRIMARY KEY,
    token_jti   VARCHAR(255) NOT NULL UNIQUE,
    token_type  VARCHAR(20) NOT NULL DEFAULT 'access',
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blacklist_jti ON token_blacklist(token_jti);
CREATE INDEX IF NOT EXISTS idx_blacklist_expires ON token_blacklist(expires_at);

-- Enable Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies: tenant isolation
CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_sessions ON sessions
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
