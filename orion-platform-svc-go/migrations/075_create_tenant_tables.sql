-- Tenant module tables

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_name ON tenants(name);

CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id);

CREATE TABLE IF NOT EXISTS tenant_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    invite_code VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    invited_by VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(tenant_id, invite_code)
);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_tenant_id ON tenant_invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_email ON tenant_invites(email);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_status ON tenant_invites(status);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_expires_at ON tenant_invites(expires_at);

CREATE TABLE IF NOT EXISTS namespace_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    namespace_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'allocated',
    purpose VARCHAR(255),
    runner_count INTEGER DEFAULT 0,
    allocated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(tenant_id, namespace_name)
);

CREATE INDEX IF NOT EXISTS idx_namespace_allocations_tenant_id ON namespace_allocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_namespace_allocations_status ON namespace_allocations(status);

CREATE TABLE IF NOT EXISTS tenant_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    max_pipelines INTEGER DEFAULT 0,
    max_pipeline_runs_per_day INTEGER DEFAULT 0,
    max_concurrent_runs INTEGER DEFAULT 0,
    max_tasks_per_pipeline INTEGER DEFAULT 0,
    max_runners INTEGER DEFAULT 0,
    max_cpu_cores INTEGER DEFAULT 0,
    max_memory_gb INTEGER DEFAULT 0,
    max_storage_gb INTEGER DEFAULT 0,
    max_namespaces INTEGER DEFAULT 0,
    api_rate_limit INTEGER DEFAULT 0,
    api_rate_limit_window_seconds INTEGER DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_quotas_tenant_id ON tenant_quotas(tenant_id);

CREATE TABLE IF NOT EXISTS tenant_quota_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    threshold_percent INTEGER NOT NULL,
    current_usage INTEGER NOT NULL,
    quota_limit INTEGER NOT NULL,
    usage_percent INTEGER NOT NULL,
    notify_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    cooldown_until TEXT,
    created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tenant_quota_alerts_tenant_id ON tenant_quota_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_quota_alerts_notify_status ON tenant_quota_alerts(notify_status);
