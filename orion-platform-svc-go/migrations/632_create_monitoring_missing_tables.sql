-- 632_create_monitoring_missing_tables.sql
-- monitoring 模块: monitoring_status / monitoring_metric_points 2 张表无 CREATE TABLE。
-- monitoring_status 用 tenant_id 单列主键 (ON CONFLICT upsert 模式)。
-- 回滚见 632_create_monitoring_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS monitoring_status (
    tenant_id  UUID PRIMARY KEY,
    status     TEXT NOT NULL DEFAULT 'unknown',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitoring_metric_points (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    metric_name  TEXT NOT NULL,
    value        DOUBLE PRECISION NOT NULL DEFAULT 0,
    labels       JSONB DEFAULT '{}',
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_monitoring_metric_points_tenant ON monitoring_metric_points(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_metric_points_metric ON monitoring_metric_points(metric_name);
