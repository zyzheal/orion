-- Migration 728: DevOps Secrets — 密钥管理
CREATE TABLE IF NOT EXISTS devops_secrets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    secret_type     TEXT NOT NULL DEFAULT 'string',
    -- string, json, encrypted
    value_encrypted BYTEA,
    key_id          TEXT NOT NULL DEFAULT 'default-key',
    environment     TEXT NOT NULL DEFAULT 'global',
    description     TEXT,
    rotation_days   INTEGER,
    last_rotated    TIMESTAMPTZ,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name, environment)
);
CREATE INDEX idx_devops_secrets_tenant ON devops_secrets(tenant_id, enabled);
