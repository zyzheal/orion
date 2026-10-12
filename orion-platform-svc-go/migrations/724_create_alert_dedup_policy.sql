-- Migration 724: Alert Deduplication Policy — 去重策略持久化

CREATE TABLE IF NOT EXISTS alert_dedup_policies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    strategy        TEXT NOT NULL DEFAULT 'fingerprint',
    -- Strategies: fingerprint, label_match, exact_match
    fingerprint_keys TEXT NOT NULL DEFAULT '[]',
    match_window_sec INTEGER NOT NULL DEFAULT 300,
    max_groups      INTEGER NOT NULL DEFAULT 100,
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX idx_alert_dedup_policies_tenant ON alert_dedup_policies(tenant_id);
