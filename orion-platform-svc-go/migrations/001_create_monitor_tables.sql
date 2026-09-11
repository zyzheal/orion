-- 001_create_monitor_tables.sql
-- Metrics table for time-series metric data points
CREATE TABLE IF NOT EXISTS metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    tags JSONB,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Traces table for distributed tracing spans
CREATE TABLE IF NOT EXISTS traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    trace_id VARCHAR(64) NOT NULL,
    span_id VARCHAR(64) NOT NULL,
    parent_span_id VARCHAR(64),
    service_name VARCHAR(255),
    operation_name VARCHAR(255),
    status VARCHAR(50),
    duration_ms INTEGER,
    attributes JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Alerts table for alert instances
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    rule_name VARCHAR(255),
    severity VARCHAR(50),
    status VARCHAR(50),
    description TEXT,
    triggered_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
-- 补齐 alerts：005_create_alert_tables.sql 的定义晚于 001_create_monitor_tables.sql，按序执行时表已存在
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS source_type VARCHAR(100), ADD COLUMN IF NOT EXISTS source_id VARCHAR(255), ADD COLUMN IF NOT EXISTS source_name VARCHAR(255), ADD COLUMN IF NOT EXISTS labels JSONB, ADD COLUMN IF NOT EXISTS annotations JSONB, ADD COLUMN IF NOT EXISTS value DOUBLE PRECISION DEFAULT 0, ADD COLUMN IF NOT EXISTS threshold DOUBLE PRECISION DEFAULT 0, ADD COLUMN IF NOT EXISTS metric VARCHAR(255), ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS group_id VARCHAR(255), ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL;


-- Alert rules table for monitoring rule definitions
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255),
    metric_name VARCHAR(255),
    operator VARCHAR(10),
    threshold DOUBLE PRECISION,
    evaluation_interval_sec INTEGER,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
-- 补齐 alert_rules：363_create_alert_rules.sql 的定义晚于 001_create_monitor_tables.sql，按序执行时表已存在
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS expression TEXT, ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE, ADD COLUMN IF NOT EXISTS "group" VARCHAR(128);


-- Indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_metrics_tenant_ts ON metrics(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_traces_tenant_ts ON traces(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_traces_service ON traces(service_name);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id);
