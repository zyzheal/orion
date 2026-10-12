-- Migration 721: Alert Events — 持久化告警事件
-- 替代 memory-only 存储，防止重启丢失

CREATE TABLE IF NOT EXISTS alert_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    source_id       TEXT NOT NULL,
    event_type      TEXT NOT NULL,
    -- Types: fired, resolved, acknowledged, suppressed
    severity        TEXT NOT NULL DEFAULT 'warning',
    -- Severities: info, warning, error, critical
    title           TEXT NOT NULL,
    message         TEXT,
    labels          JSONB NOT NULL DEFAULT '{}',
    annotations     JSONB NOT NULL DEFAULT '{}',
    starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at         TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'firing',
    -- Statuses: firing, resolved, acknowledged
    dedup_key       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_events_tenant ON alert_events(tenant_id, status);
CREATE INDEX idx_alert_events_source ON alert_events(tenant_id, source_id);
CREATE INDEX idx_alert_events_dedup ON alert_events(tenant_id, dedup_key) WHERE dedup_key IS NOT NULL;
