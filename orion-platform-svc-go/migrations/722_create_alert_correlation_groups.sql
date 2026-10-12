-- Migration 722: Alert Correlation Groups — 关联组持久化

CREATE TABLE IF NOT EXISTS alert_correlation_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    root_alert_id   UUID NOT NULL,
    alert_ids       JSONB NOT NULL DEFAULT '[]',
    group_type      TEXT NOT NULL DEFAULT 'time_window',
    -- Types: time_window, service_tag, error_pattern
    rule_id         UUID,
    status          TEXT NOT NULL DEFAULT 'active',
    -- Statuses: active, merged, resolved
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_correlation_groups_tenant ON alert_correlation_groups(tenant_id, status);
CREATE INDEX idx_alert_correlation_groups_type ON alert_correlation_groups(tenant_id, group_type);
