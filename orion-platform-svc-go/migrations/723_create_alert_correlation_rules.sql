-- Migration 723: Alert Correlation Rules — 关联规则持久化

CREATE TABLE IF NOT EXISTS alert_correlation_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    group_type      TEXT NOT NULL DEFAULT 'time_window',
    time_window_sec INTEGER NOT NULL DEFAULT 300,
    conditions      JSONB NOT NULL DEFAULT '{}',
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX idx_alert_correlation_rules_tenant ON alert_correlation_rules(tenant_id);
