-- Worker Dispatcher module tables (N-12)

CREATE TABLE IF NOT EXISTS worker_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,            -- round_robin, least_loaded, skill_match, role_based, department_based, weight, custom
    config TEXT,                           -- JSON configuration
    priority BIGINT DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_worker_policies_tenant_id ON worker_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_worker_policies_type ON worker_policies(type);
CREATE INDEX IF NOT EXISTS idx_worker_policies_enabled ON worker_policies(enabled);

CREATE TABLE IF NOT EXISTS worker_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    policy_id UUID,
    target_type VARCHAR(50) NOT NULL,      -- ticket, task, incident, change
    target_id VARCHAR(255) NOT NULL,
    worker_id VARCHAR(255) NOT NULL,
    worker_type VARCHAR(50) DEFAULT 'user', -- user, role, group, auto
    status VARCHAR(50) NOT NULL DEFAULT 'assigned', -- assigned, in_progress, completed, cancelled
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_worker_assignments_tenant_id ON worker_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_worker_assignments_target ON worker_assignments(target_id);
CREATE INDEX IF NOT EXISTS idx_worker_assignments_worker ON worker_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_assignments_policy ON worker_assignments(policy_id);
CREATE INDEX IF NOT EXISTS idx_worker_assignments_status ON worker_assignments(status);

CREATE TABLE IF NOT EXISTS worker_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    worker_id VARCHAR(255) NOT NULL,
    worker_type VARCHAR(50) DEFAULT 'user',
    skill VARCHAR(255) NOT NULL,
    level SMALLINT DEFAULT 1,              -- 1-5
    weight SMALLINT DEFAULT 50,            -- 0-100
    max_load BIGINT DEFAULT 10,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_worker_capabilities_tenant_id ON worker_capabilities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_worker_capabilities_worker_id ON worker_capabilities(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_capabilities_skill ON worker_capabilities(skill);
