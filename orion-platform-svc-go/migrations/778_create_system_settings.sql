-- Migration 778: System Settings — 系统全局设置
CREATE TABLE IF NOT EXISTS system_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    setting_key     TEXT NOT NULL,
    setting_value   TEXT,
    setting_type    TEXT NOT NULL DEFAULT 'string',
    -- string, number, boolean, json
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, setting_key)
);
CREATE INDEX idx_system_settings_tenant ON system_settings(tenant_id);
