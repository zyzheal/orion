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
