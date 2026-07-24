-- Migration 071: JWT Key Rotation Tables
-- Manages JWT signing key rotation for enhanced authentication security

-- JWT key rotation management table
CREATE TABLE IF NOT EXISTS jwt_key_rotation (
    id SERIAL PRIMARY KEY,
    key_id VARCHAR(64) NOT NULL UNIQUE,
    key_hash VARCHAR(256) NOT NULL,
    key_strength VARCHAR(32) NOT NULL DEFAULT '256-bit',
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    rotation_trigger VARCHAR(32) DEFAULT 'scheduled',
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_jwt_key_rotation_status ON jwt_key_rotation(status);
CREATE INDEX idx_jwt_key_rotation_expires ON jwt_key_rotation(expires_at);
CREATE INDEX idx_jwt_key_rotation_key_id ON jwt_key_rotation(key_id);

-- Key rotation history table for audit trail
CREATE TABLE IF NOT EXISTS jwt_key_rotation_history (
    id SERIAL PRIMARY KEY,
    old_key_id VARCHAR(64),
    new_key_id VARCHAR(64) NOT NULL,
    rotation_type VARCHAR(32) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_jwt_rotation_history_started ON jwt_key_rotation_history(started_at);
CREATE INDEX idx_jwt_rotation_history_type ON jwt_key_rotation_history(rotation_type);

COMMENT ON TABLE jwt_key_rotation IS 'JWT signing key rotation management for security compliance';
COMMENT ON TABLE jwt_key_rotation_history IS 'Audit trail for JWT key rotation events';

COMMENT ON COLUMN jwt_key_rotation.key_id IS 'Unique identifier for the JWT key';
COMMENT ON COLUMN jwt_key_rotation.key_hash IS 'SHA-256 hash of the actual key (not stored)';
COMMENT ON COLUMN jwt_key_rotation.key_strength IS 'Key strength: 128-bit, 192-bit, or 256-bit';
COMMENT ON COLUMN jwt_key_rotation.status IS 'Key status: pending, active, expiring, expired';
COMMENT ON COLUMN jwt_key_rotation.rotation_trigger IS 'Trigger type: scheduled, manual, emergency';

-- Rollback:
-- DROP TABLE IF EXISTS jwt_key_rotation_history;
-- DROP TABLE IF EXISTS jwt_key_rotation;