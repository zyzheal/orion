-- Migration 746: Alert SLA — 告警响应 SLA
CREATE TABLE IF NOT EXISTS alert_sla (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    severity        TEXT NOT NULL DEFAULT 'all',
    response_time   INTEGER NOT NULL DEFAULT 300,
    -- Seconds to acknowledge
    resolve_time    INTEGER NOT NULL DEFAULT 3600,
    -- Seconds to resolve
    escalation_delay INTEGER NOT NULL DEFAULT 600,
    -- Seconds before escalation
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);
CREATE INDEX idx_alert_sla_tenant ON alert_sla(tenant_id, enabled);
