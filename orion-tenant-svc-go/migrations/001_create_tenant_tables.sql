-- Tenant service migrations
-- 001: Create tenant, namespace, quota, and RLS policy tables

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    display_name VARCHAR(256),
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_name ON tenants(name);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Tenant namespaces
CREATE TABLE IF NOT EXISTS tenant_namespaces (
    id VARCHAR(64) PRIMARY KEY,
    namespace_name VARCHAR(256) NOT NULL,
    cluster_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'available',
    purpose VARCHAR(256),
    labels JSONB,
    allocated_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_namespaces_tenant ON tenant_namespaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_namespaces_cluster ON tenant_namespaces(cluster_id);
CREATE INDEX IF NOT EXISTS idx_tenant_namespaces_status ON tenant_namespaces(status);

-- Quota configs
CREATE TABLE IF NOT EXISTS quota_configs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    max_pipelines INT DEFAULT 0,
    max_pipeline_runs_per_day INT DEFAULT 0,
    max_concurrent_builds INT DEFAULT 0,
    max_tasks_per_pipeline INT DEFAULT 0,
    max_runners INT DEFAULT 0,
    max_cpu_cores INT DEFAULT 0,
    max_memory_gb INT DEFAULT 0,
    max_storage_mb INT DEFAULT 0,
    max_projects INT DEFAULT 0,
    max_users INT DEFAULT 0,
    api_rate_limit INT DEFAULT 0,
    api_rate_limit_window_seconds INT DEFAULT 0,
    usage JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quota_configs_tenant ON quota_configs(tenant_id);

-- RLS policies
CREATE TABLE IF NOT EXISTS rls_policies (
    id VARCHAR(64) PRIMARY KEY,
    table_name VARCHAR(256) NOT NULL,
    policy_name VARCHAR(256) NOT NULL,
    session_variable VARCHAR(128) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_rls_policies_table ON rls_policies(table_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rls_policies_unique ON rls_policies(table_name, policy_name);
