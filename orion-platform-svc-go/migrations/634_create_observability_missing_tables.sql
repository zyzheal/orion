-- 634_create_observability_missing_tables.sql
-- observability 模块: observability_metrics / observability_alert_rules 2 张表无 CREATE TABLE。
-- observability_metrics 是事件流，无 id 列；observability_alert_rules 用 (tenant_id, metric) 单例模式。
-- 回滚见 634_create_observability_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS observability_metrics (
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL,
    value      DOUBLE PRECISION NOT NULL DEFAULT 0,
    tags       JSONB DEFAULT '{}',
    timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_observability_metrics_tenant ON observability_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_observability_metrics_name ON observability_metrics(name);

CREATE TABLE IF NOT EXISTS observability_alert_rules (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    metric     TEXT NOT NULL,
    operator   TEXT NOT NULL DEFAULT '>',
    threshold  DOUBLE PRECISION NOT NULL DEFAULT 0,
    severity   TEXT NOT NULL DEFAULT 'warning',
    enabled    BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_observability_alert_rules_tenant ON observability_alert_rules(tenant_id);
