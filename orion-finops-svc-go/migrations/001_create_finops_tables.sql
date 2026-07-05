CREATE TABLE IF NOT EXISTS cloud_costs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    resource_type VARCHAR(128) NOT NULL,
    resource_id VARCHAR(256) NOT NULL,
    provider VARCHAR(64) NOT NULL,
    region VARCHAR(64) NOT NULL,
    service VARCHAR(128) NOT NULL,
    cost_cents BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    usage_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    usage_unit VARCHAR(32) NOT NULL DEFAULT '',
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    tags JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cloud_costs_tenant ON cloud_costs(tenant_id, period_start);
CREATE INDEX idx_cloud_costs_provider ON cloud_costs(provider, service);

CREATE TABLE IF NOT EXISTS k8s_costs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    cluster VARCHAR(128) NOT NULL,
    namespace VARCHAR(128) NOT NULL,
    workload VARCHAR(256) NOT NULL,
    workload_type VARCHAR(32) NOT NULL DEFAULT '',
    cpu_cost_cents BIGINT NOT NULL DEFAULT 0,
    mem_cost_cents BIGINT NOT NULL DEFAULT 0,
    storage_cost_cents BIGINT NOT NULL DEFAULT 0,
    total_cost_cents BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    cpu_usage DOUBLE PRECISION NOT NULL DEFAULT 0,
    mem_usage DOUBLE PRECISION NOT NULL DEFAULT 0,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_k8s_costs_tenant ON k8s_costs(tenant_id, period_start);
CREATE INDEX idx_k8s_costs_cluster ON k8s_costs(cluster, namespace);

CREATE TABLE IF NOT EXISTS saas_costs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    provider VARCHAR(128) NOT NULL,
    plan VARCHAR(128) NOT NULL DEFAULT '',
    seats_used INT NOT NULL DEFAULT 0,
    seats_total INT NOT NULL DEFAULT 0,
    cost_cents BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saas_costs_tenant ON saas_costs(tenant_id, period_start);

CREATE TABLE IF NOT EXISTS budget_alerts (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    budget_cents BIGINT NOT NULL,
    threshold_pct INT NOT NULL DEFAULT 80,
    current_spend_cents BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    notify_email VARCHAR(256) NOT NULL,
    period VARCHAR(16) NOT NULL DEFAULT 'monthly',
    last_triggered_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budget_alerts_tenant ON budget_alerts(tenant_id, status);
