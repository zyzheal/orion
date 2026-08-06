-- ============================================================
-- Alert Deduplication Module (P1-09)
-- ============================================================
-- Tables: alert_deduplication_records
-- ============================================================

CREATE TABLE IF NOT EXISTS alert_deduplication_records (
    id            UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    original_id   UUID NOT NULL,
    duplicate_id  UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    fingerprint   VARCHAR(128) NOT NULL,
    deduped_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_adr_tenant ON alert_deduplication_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_adr_fingerprint ON alert_deduplication_records(tenant_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_adr_deduped_at ON alert_deduplication_records(deduped_at);
