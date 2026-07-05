-- F016: Disaster Recovery Policy Engine
-- PostgreSQL persistence for DR plans, strategies, and policies

-- 1. DR Policy Table
CREATE TABLE IF NOT EXISTS disaster_recovery_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    services TEXT[] NOT NULL DEFAULT '{}', -- Service IDs
    strategy VARCHAR(50) NOT NULL CHECK (strategy IN ('active-active', 'active-passive', 'warm-standby', 'cold-standby')),
    rpo VARCHAR(50) NOT NULL, -- Recovery Point Objective
    rto VARCHAR(50) NOT NULL, -- Recovery Time Objective
    priority INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'testing', 'inactive', 'failed')),
    tenant_id UUID NOT NULL,
    project_id UUID,
    created_by_id UUID,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(name, tenant_id)
);

-- 2. Failover Execution History Table
CREATE TABLE IF NOT EXISTS disaster_recovery_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES disaster_recovery_policies(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('test', 'failover', 'rollback')),
    status VARCHAR(50) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
    source_region VARCHAR(100),
    target_region VARCHAR(100),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    actual_rto_ms BIGINT,
    actual_rpo_ms BIGINT,
    services_executed TEXT[],
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Health Check History Table (for compliance tracking)
CREATE TABLE IF NOT EXISTS disaster_recovery_health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES disaster_recovery_policies(id) ON DELETE CASCADE,
    region VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    latency_ms INTEGER,
    error_count INTEGER DEFAULT 0,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dr_policies_tenant ON disaster_recovery_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dr_policies_strategy ON disaster_recovery_policies(strategy);
CREATE INDEX IF NOT EXISTS idx_dr_policies_status ON disaster_recovery_policies(status);
CREATE INDEX IF NOT EXISTS idx_dr_executions_policy ON disaster_recovery_executions(policy_id);
CREATE INDEX IF NOT EXISTS idx_dr_executions_status ON disaster_recovery_executions(status);
CREATE INDEX IF NOT EXISTS idx_dr_executions_type ON disaster_recovery_executions(type);
CREATE INDEX IF NOT EXISTS idx_dr_health_checks_policy ON disaster_recovery_health_checks(policy_id);
CREATE INDEX IF NOT EXISTS idx_dr_health_checks_region ON disaster_recovery_health_checks(region);

-- 5. Enable row-level security (optional - for multi-tenant isolation)
-- ALTER TABLE disaster_recovery_policies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE disaster_recovery_executions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE disaster_recovery_health_checks ENABLE ROW LEVEL SECURITY;
