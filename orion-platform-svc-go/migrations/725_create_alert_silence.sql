-- Migration 725: Alert Silence — 静默规则持久化

CREATE TABLE IF NOT EXISTS alert_silences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    matcher_type    TEXT NOT NULL DEFAULT 'label_match',
    -- Types: label_match, exact_match
    matchers        JSONB NOT NULL DEFAULT '[]',
    comment         TEXT NOT NULL,
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    created_by      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active',
    -- Statuses: active, expired, deleted
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_silences_tenant ON alert_silences(tenant_id, status);
CREATE INDEX idx_alert_silences_time ON alert_silences(tenant_id, ends_at);
