-- 645_create_slo_missing_tables.sql
-- slo 模块: slo_definitions / sli_measurements 2 张表无 CREATE TABLE。
-- 回滚见 645_create_slo_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS slo_definitions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL,
    name               TEXT NOT NULL,
    display_name       TEXT NOT NULL DEFAULT '',
    slo_type           TEXT NOT NULL DEFAULT 'availability',
    target             DOUBLE PRECISION NOT NULL DEFAULT 99.9,
    measurement_window TEXT NOT NULL DEFAULT '30d',
    alert_threshold    DOUBLE PRECISION NOT NULL DEFAULT 95,
    metric_query       TEXT NOT NULL DEFAULT '',
    enabled            BOOLEAN NOT NULL DEFAULT TRUE,
    description        TEXT NOT NULL DEFAULT '',
    tags               TEXT NOT NULL DEFAULT '',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_slo_definitions_tenant ON slo_definitions(tenant_id);

CREATE TABLE IF NOT EXISTS sli_measurements (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slo_id        UUID NOT NULL,
    tenant_id     UUID NOT NULL,
    value         DOUBLE PRECISION NOT NULL DEFAULT 0,
    measured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total         BIGINT NOT NULL DEFAULT 0,
    success       BIGINT NOT NULL DEFAULT 0,
    error_count   BIGINT NOT NULL DEFAULT 0,
    metadata      JSONB DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sli_measurements_slo ON sli_measurements(slo_id);
CREATE INDEX IF NOT EXISTS idx_sli_measurements_tenant ON sli_measurements(tenant_id);
