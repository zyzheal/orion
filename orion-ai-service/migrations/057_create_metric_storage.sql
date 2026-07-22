-- Metric Storage 表迁移
-- 对应 TS: src/db/migrations/406_metric_storage.sql

-- ==================== Metric Registry ====================
-- 存储指标定义（名称、单位、默认标签、描述）

CREATE TABLE IF NOT EXISTS metric_registry (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    default_tags JSONB DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_metric_name_per_tenant UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_metric_registry_tenant ON metric_registry(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metric_registry_name ON metric_registry(name);
CREATE INDEX IF NOT EXISTS idx_metric_registry_tenant_name ON metric_registry(tenant_id, name);

-- ==================== Metric Data Points ====================
-- 存储时序指标数据点

CREATE TABLE IF NOT EXISTS metric_data_points (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    metric_name TEXT NOT NULL,
    value NUMERIC NOT NULL,
    tags JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metric_data_points_tenant_metric ON metric_data_points(tenant_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_metric_data_points_timestamp ON metric_data_points(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metric_data_points_metric_timestamp ON metric_data_points(metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metric_data_points_tags ON metric_data_points USING GIN (tags);
