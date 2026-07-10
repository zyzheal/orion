-- Tenant service migrations
-- 001: Create tenant, namespace, quota, RLS policy, user, invite, and alert tables

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

-- Tenant-User relationship
CREATE TABLE IF NOT EXISTS tenant_users (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'member',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id);

-- Tenant Invites
CREATE TABLE IF NOT EXISTS tenant_invites (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(256) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'member',
    invite_code VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    invited_by VARCHAR(64),
    accepted_by VARCHAR(64),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_tenant ON tenant_invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_code ON tenant_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_email ON tenant_invites(email);

-- Namespace allocations (K8s namespace pool)
CREATE TABLE IF NOT EXISTS namespace_allocations (
    id VARCHAR(64) PRIMARY KEY,
    namespace_name VARCHAR(256) NOT NULL UNIQUE,
    cluster_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'available',
    purpose VARCHAR(256),
    labels JSONB DEFAULT '{}',
    allocated_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_namespace_allocations_tenant ON namespace_allocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_namespace_allocations_cluster ON namespace_allocations(cluster_id);
CREATE INDEX IF NOT EXISTS idx_namespace_allocations_status ON namespace_allocations(status);

-- Quota configs
CREATE TABLE IF NOT EXISTS tenant_quotas (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    max_pipelines INT DEFAULT 100,
    max_pipeline_runs_per_day INT DEFAULT 1000,
    max_concurrent_builds INT DEFAULT 10,
    max_tasks_per_pipeline INT DEFAULT 50,
    max_runners INT DEFAULT 5,
    max_cpu_cores INT DEFAULT 16,
    max_memory_gb INT DEFAULT 32,
    max_storage_mb INT DEFAULT 102400,
    max_projects INT DEFAULT 10,
    max_users INT DEFAULT 100,
    api_rate_limit INT DEFAULT 1000,
    api_rate_limit_window_seconds INT DEFAULT 60,
    usage JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_quotas_tenant ON tenant_quotas(tenant_id);

-- Tenant Quota Alerts
CREATE TABLE IF NOT EXISTS tenant_quota_alerts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    threshold_percent DECIMAL(5,1) NOT NULL,
    current_usage DECIMAL(12,2) NOT NULL,
    quota_limit DECIMAL(12,2) NOT NULL,
    notify_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    cooldown_until TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_quota_alerts_tenant ON tenant_quota_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_quota_alerts_resource ON tenant_quota_alerts(resource_type);
CREATE INDEX IF NOT EXISTS idx_tenant_quota_alerts_status ON tenant_quota_alerts(notify_status);

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
