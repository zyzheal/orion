-- Migration 780: System Events — 系统事件日志
CREATE TABLE IF NOT EXISTS system_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    event_type      TEXT NOT NULL,
    -- login, logout, config_change, deploy, error, etc.
    source          TEXT NOT NULL DEFAULT 'system',
    severity        TEXT NOT NULL DEFAULT 'info',
    -- debug, info, warning, error, critical
    message         TEXT NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_system_events_type ON system_events(tenant_id, event_type, created_at DESC);
CREATE INDEX idx_system_events_severity ON system_events(tenant_id, severity, created_at DESC);
