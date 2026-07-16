-- Metric Storage tables for MetricCollector PostgreSQL persistence
-- Supports metric_registry and metric_data_points for time-series metrics

-- ==================== Metric Registry ====================
-- Stores metric definitions (name, unit, default tags, description)

CREATE TABLE IF NOT EXISTS metric_registry (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(64) NOT NULL,
    default_tags JSONB DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Unique constraint: one metric definition per name per tenant
    CONSTRAINT unique_metric_name_per_tenant UNIQUE (tenant_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_metric_registry_tenant ON metric_registry(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metric_registry_name ON metric_registry(name);
CREATE INDEX IF NOT EXISTS idx_metric_registry_tenant_name ON metric_registry(tenant_id, name);

-- Row Level Security
ALTER TABLE metric_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_metric_registry ON metric_registry
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

-- ==================== Metric Data Points ====================
-- Stores time-series metric data points

CREATE TABLE IF NOT EXISTS metric_data_points (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    metric_name VARCHAR(255) NOT NULL,
    value NUMERIC NOT NULL,
    tags JSONB DEFAULT '{}',
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Foreign key to metric_registry
    CONSTRAINT fk_metric_data_points_registry
        FOREIGN KEY (tenant_id, metric_name)
        REFERENCES metric_registry(tenant_id, name)
        ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_metric_data_points_tenant_metric ON metric_data_points(tenant_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_metric_data_points_timestamp ON metric_data_points(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metric_data_points_metric_timestamp ON metric_data_points(metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metric_data_points_tags ON metric_data_points USING GIN (tags);

-- Row Level Security
ALTER TABLE metric_data_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_metric_data_points ON metric_data_points
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );
