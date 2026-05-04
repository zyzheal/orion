-- Migration 072: Token Blacklist Tables
-- Persistent storage for revoked JWT tokens (primary storage is Redis)

-- Token blacklist table for revoked token tracking
CREATE TABLE IF NOT EXISTS token_blacklist (
    id SERIAL PRIMARY KEY,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    user_id VARCHAR(64) NOT NULL,
    tenant_id INTEGER NOT NULL,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoke_reason VARCHAR(32) NOT NULL,
    revoked_by VARCHAR(64),
    metadata JSONB DEFAULT '{}'
);

-- Indexes for efficient lookups
CREATE INDEX idx_token_blacklist_hash ON token_blacklist(token_hash);
CREATE INDEX idx_token_blacklist_user ON token_blacklist(user_id);
CREATE INDEX idx_token_blacklist_tenant ON token_blacklist(tenant_id);
CREATE INDEX idx_token_blacklist_expires ON token_blacklist(expires_at);

-- Batch revocation records table
CREATE TABLE IF NOT EXISTS token_revocation_batch (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(64) NOT NULL UNIQUE,
    revocation_type VARCHAR(32) NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    revoked_count INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_token_revocation_batch_id ON token_revocation_batch(batch_id);
CREATE INDEX idx_token_revocation_batch_target ON token_revocation_batch(target_type, target_id);
CREATE INDEX idx_token_revocation_batch_started ON token_revocation_batch(started_at);

COMMENT ON TABLE token_blacklist IS 'Persistent token blacklist for JWT revocation (Redis is primary storage)';
COMMENT ON TABLE token_revocation_batch IS 'Batch token revocation records for user/tenant-wide logout';

COMMENT ON COLUMN token_blacklist.token_hash IS 'SHA-256 hash of the revoked token (first 64 chars)';
COMMENT ON COLUMN token_blacklist.user_id IS 'ID of the user whose token was revoked';
COMMENT ON COLUMN token_blacklist.tenant_id IS 'Tenant ID for multi-tenant isolation';
COMMENT ON COLUMN token_blacklist.revoke_reason IS 'Reason: logout, security_incident, password_change, admin_revocation';
COMMENT ON COLUMN token_blacklist.revoked_by IS 'ID of admin who revoked (if admin-initiated)';

COMMENT ON COLUMN token_revocation_batch.batch_id IS 'Unique identifier for the batch revocation';
COMMENT ON COLUMN token_revocation_batch.revocation_type IS 'Type: user_logout, tenant_suspension, security_breach';
COMMENT ON COLUMN token_revocation_batch.target_type IS 'Target scope: user, tenant, all';
COMMENT ON COLUMN token_revocation_batch.target_id IS 'ID of the target (user_id or tenant_id)';

-- Rollback:
-- DROP TABLE IF EXISTS token_revocation_batch;
-- DROP TABLE IF EXISTS token_blacklist;