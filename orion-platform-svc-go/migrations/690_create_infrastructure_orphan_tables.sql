-- 690_create_infrastructure_orphan_tables.sql
--
-- Missing DDL for the 12 infrastructure-domain orphan tables that
-- internal/infrastructure/* repositories reference but no earlier migration
-- creates. Inventory: docs/orphan-tables-inventory-2026-09-16.md.
--
-- Column shapes read from each repository's INSERT column list and the
-- module's db tags. Notes:
--   * dba_orders.database is a bare PG non-reserved-word column, matching the
--     repository's INSERT; `database` is never quoted in code.
--   * capacity_reports.alerts_snapshot / forecasts_snapshot and the
--     digital-twin components/topology/config/metadata/resources/env_vars
--     columns are JSONB (bound as ::jsonb or via models that cast).
--   * serverless_logs / serverless_metrics are only read by SELECT * and
--     scanned into models; the columns here are exactly the model db tags.
--   * twin_snapshots / twin_sandboxes carry completed_at / started_at as
--     nullable timestamps.
--
-- Idempotent by construction (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS capacity_alerts (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    resource_id VARCHAR(64),
    resource_type VARCHAR(128),
    metric_name VARCHAR(128),
    current_utilization DOUBLE PRECISION DEFAULT 0,
    threshold DOUBLE PRECISION DEFAULT 0,
    severity VARCHAR(16) DEFAULT 'warning',
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capacity_alerts_tenant ON capacity_alerts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_capacity_alerts_severity ON capacity_alerts(severity);

CREATE TABLE IF NOT EXISTS capacity_forecasts (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    resource_type VARCHAR(128),
    current_usage DOUBLE PRECISION DEFAULT 0,
    predicted DOUBLE PRECISION DEFAULT 0,
    threshold DOUBLE PRECISION DEFAULT 0,
    days_until_full INT DEFAULT 0,
    recommendation TEXT,
    forecast_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capacity_forecasts_tenant ON capacity_forecasts(tenant_id, forecast_date DESC);

CREATE TABLE IF NOT EXISTS capacity_metrics (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    resource_type VARCHAR(128),
    resource_id VARCHAR(64),
    metric_name VARCHAR(128),
    current_value DOUBLE PRECISION DEFAULT 0,
    max_value DOUBLE PRECISION DEFAULT 0,
    unit VARCHAR(32),
    utilization_percent DOUBLE PRECISION DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capacity_metrics_tenant ON capacity_metrics(tenant_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS capacity_reports (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    total_resources INT DEFAULT 0,
    healthy_count INT DEFAULT 0,
    warning_count INT DEFAULT 0,
    critical_count INT DEFAULT 0,
    overall_score INT DEFAULT 0,
    alerts_snapshot JSONB DEFAULT '{}'::jsonb,
    forecasts_snapshot JSONB DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capacity_reports_tenant ON capacity_reports(tenant_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS dba_orders (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    database VARCHAR(255),
    sql_content TEXT,
    status VARCHAR(32) DEFAULT 'pending',
    created_by VARCHAR(64),
    approved_by VARCHAR(64),
    executed_by VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dba_orders_tenant ON dba_orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dba_orders_status ON dba_orders(status);

CREATE TABLE IF NOT EXISTS dba_query_logs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    data_source_id VARCHAR(36),
    sql_content TEXT,
    status VARCHAR(32),
    duration INT DEFAULT 0,
    row_count INT DEFAULT 0,
    error_message TEXT,
    created_by VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dba_query_logs_tenant ON dba_query_logs(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS multicloud_providers (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_multicloud_providers_tenant ON multicloud_providers(tenant_id);

CREATE TABLE IF NOT EXISTS scaling_policies (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(128),
    min_replicas INT DEFAULT 1,
    max_replicas INT DEFAULT 10,
    scale_up_threshold DOUBLE PRECISION DEFAULT 70,
    scale_down_threshold DOUBLE PRECISION DEFAULT 30,
    cooldown_sec INT DEFAULT 300,
    enabled BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_scaling_policies_tenant ON scaling_policies(tenant_id);

CREATE TABLE IF NOT EXISTS serverless_logs (
    id VARCHAR(36) PRIMARY KEY,
    function_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    level VARCHAR(16) DEFAULT 'info',
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_serverless_logs_tenant ON serverless_logs(tenant_id, function_id, created_at DESC);

CREATE TABLE IF NOT EXISTS serverless_metrics (
    id VARCHAR(36) PRIMARY KEY,
    function_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    invocations INT DEFAULT 0,
    avg_duration_ms DOUBLE PRECISION DEFAULT 0,
    error_count INT DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_serverless_metrics_tenant ON serverless_metrics(tenant_id, function_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS twin_snapshots (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    environment VARCHAR(64),
    status VARCHAR(32) DEFAULT 'created',
    components JSONB DEFAULT '{}'::jsonb,
    topology JSONB DEFAULT '{}'::jsonb,
    size_bytes BIGINT DEFAULT 0,
    storage_path VARCHAR(512),
    config JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by VARCHAR(64),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_twin_snapshots_tenant ON twin_snapshots(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_twin_snapshots_status ON twin_snapshots(status);

CREATE TABLE IF NOT EXISTS twin_sandboxes (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    twin_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    snapshot_id VARCHAR(36),
    status VARCHAR(32) DEFAULT 'stopped',
    endpoint VARCHAR(255),
    resources JSONB DEFAULT '{}'::jsonb,
    env_vars JSONB DEFAULT '{}'::jsonb,
    network_isolation BOOLEAN DEFAULT FALSE,
    health_status VARCHAR(32) DEFAULT 'healthy',
    started_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_twin_sandboxes_tenant ON twin_sandboxes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_twin_sandboxes_status ON twin_sandboxes(status);