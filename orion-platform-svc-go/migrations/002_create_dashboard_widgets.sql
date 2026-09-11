-- 002_create_dashboard_widgets.sql
-- Dashboard widget configurations for monitoring dashboards
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    metrics JSONB NOT NULL DEFAULT '[]',
    time_window VARCHAR(10) NOT NULL DEFAULT '1h',
    tags JSONB DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
-- 补齐 dashboard_widgets：555_create_notification_tables.sql 的定义晚于 002_create_dashboard_widgets.sql，按序执行时表已存在
ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS dashboard_id UUID NOT NULL, ADD COLUMN IF NOT EXISTS name        VARCHAR(256) NOT NULL, ADD COLUMN IF NOT EXISTS type        VARCHAR(64) NOT NULL, ADD COLUMN IF NOT EXISTS position    INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS size        VARCHAR(32) NOT NULL DEFAULT 'medium', ADD COLUMN IF NOT EXISTS config      JSONB NOT NULL DEFAULT '{}', ADD COLUMN IF NOT EXISTS enabled     BOOLEAN NOT NULL DEFAULT TRUE, ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();


CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_tenant ON dashboard_widgets(tenant_id);

-- Metric registrations for custom metric metadata
CREATE TABLE IF NOT EXISTS metric_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    default_tags JSONB DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_metric_registrations_tenant ON metric_registrations(tenant_id);
