-- Resource pools: CPU/memory/node tracking per tenant
CREATE TABLE IF NOT EXISTS resource_pools (
    id            VARCHAR(64) PRIMARY KEY,
    tenant_id     VARCHAR(64) NOT NULL,
    name          VARCHAR(255) NOT NULL,
    resource_type VARCHAR(64) NOT NULL DEFAULT 'k8s',
    total_cpu     DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_memory  DOUBLE PRECISION NOT NULL DEFAULT 0,
    used_cpu      DOUBLE PRECISION NOT NULL DEFAULT 0,
    used_memory   DOUBLE PRECISION NOT NULL DEFAULT 0,
    node_count    INT NOT NULL DEFAULT 0,
    labels        JSONB DEFAULT '{}',
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_resource_pools_tenant ON resource_pools(tenant_id);

-- Capacity forecasts: usage predictions per resource type
CREATE TABLE IF NOT EXISTS capacity_forecasts (
    id             VARCHAR(64) PRIMARY KEY,
    tenant_id      VARCHAR(64) NOT NULL,
    resource_type  VARCHAR(64) NOT NULL,
    current_usage  DOUBLE PRECISION NOT NULL DEFAULT 0,
    predicted      DOUBLE PRECISION NOT NULL DEFAULT 0,
    threshold      DOUBLE PRECISION NOT NULL DEFAULT 80,
    days_until_full INT NOT NULL DEFAULT 0,
    recommendation TEXT,
    forecast_date  DATE NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX idx_capacity_forecasts_tenant ON capacity_forecasts(tenant_id);

-- Scaling policies: auto-scaling rules per resource type
CREATE TABLE IF NOT EXISTS scaling_policies (
    id                   VARCHAR(64) PRIMARY KEY,
    tenant_id            VARCHAR(64) NOT NULL,
    name                 VARCHAR(255) NOT NULL,
    resource_type        VARCHAR(64) NOT NULL,
    min_replicas         INT NOT NULL DEFAULT 1,
    max_replicas         INT NOT NULL DEFAULT 10,
    scale_up_threshold   DOUBLE PRECISION NOT NULL DEFAULT 80,
    scale_down_threshold DOUBLE PRECISION NOT NULL DEFAULT 30,
    cooldown_sec         INT NOT NULL DEFAULT 300,
    enabled              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_scaling_policies_tenant ON scaling_policies(tenant_id);

-- Capacity metrics: resource usage measurements (cpu/memory/disk/iops/throughput)
CREATE TABLE IF NOT EXISTS capacity_metrics (
    id                   VARCHAR(64) PRIMARY KEY,
    tenant_id            VARCHAR(64) NOT NULL,
    resource_type        VARCHAR(64) NOT NULL,       -- compute/storage/network/database
    resource_id          VARCHAR(128) NOT NULL,       -- node/pod/volume identifier
    metric_name          VARCHAR(64) NOT NULL,        -- cpu/memory/disk/iops/throughput
    current_value        DOUBLE PRECISION NOT NULL DEFAULT 0,
    max_value            DOUBLE PRECISION NOT NULL DEFAULT 0,
    unit                 VARCHAR(32) NOT NULL DEFAULT '',
    utilization_percent  DOUBLE PRECISION NOT NULL DEFAULT 0,
    recorded_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_capacity_metrics_tenant ON capacity_metrics(tenant_id);
CREATE INDEX idx_capacity_metrics_resource ON capacity_metrics(tenant_id, resource_type, resource_id);

-- Capacity alerts: high-utilization warnings
CREATE TABLE IF NOT EXISTS capacity_alerts (
    id                   VARCHAR(64) PRIMARY KEY,
    tenant_id            VARCHAR(64) NOT NULL,
    resource_id          VARCHAR(128) NOT NULL,
    resource_type        VARCHAR(64) NOT NULL,
    metric_name          VARCHAR(64) NOT NULL,
    current_utilization  DOUBLE PRECISION NOT NULL DEFAULT 0,
    threshold            DOUBLE PRECISION NOT NULL DEFAULT 80,
    severity             VARCHAR(16) NOT NULL DEFAULT 'info',  -- info/warning/critical
    message              TEXT NOT NULL DEFAULT '',
    created_at           TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_capacity_alerts_tenant ON capacity_alerts(tenant_id);
CREATE INDEX idx_capacity_alerts_severity ON capacity_alerts(tenant_id, severity);

-- Capacity reports: aggregated capacity analysis snapshots
CREATE TABLE IF NOT EXISTS capacity_reports (
    id                   VARCHAR(64) PRIMARY KEY,
    tenant_id            VARCHAR(64) NOT NULL,
    title                VARCHAR(255) NOT NULL,
    total_resources      INT NOT NULL DEFAULT 0,
    healthy_count        INT NOT NULL DEFAULT 0,
    warning_count        INT NOT NULL DEFAULT 0,
    critical_count       INT NOT NULL DEFAULT 0,
    overall_score        INT NOT NULL DEFAULT 100,
    alerts_snapshot      JSONB DEFAULT '[]',
    forecasts_snapshot   JSONB DEFAULT '[]',
    generated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_capacity_reports_tenant ON capacity_reports(tenant_id);
