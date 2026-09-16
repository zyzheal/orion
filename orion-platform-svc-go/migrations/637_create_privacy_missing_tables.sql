-- 637_create_privacy_missing_tables.sql
-- privacy 模块: privacy_config 表无 CREATE TABLE。
-- 回滚见 637_create_privacy_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS privacy_config (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL,
    data_mask             TEXT NOT NULL DEFAULT '',
    retention_days        INTEGER NOT NULL DEFAULT 0,
    data_encryption       BOOLEAN NOT NULL DEFAULT FALSE,
    anonymous_stats       BOOLEAN NOT NULL DEFAULT TRUE,
    ccpa_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
    gdpr_compliance       BOOLEAN NOT NULL DEFAULT FALSE,
    user_deletion_policy  TEXT NOT NULL DEFAULT '',
    metadata              JSONB DEFAULT '{}',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_privacy_config_tenant ON privacy_config(tenant_id);
