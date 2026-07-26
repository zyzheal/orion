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
