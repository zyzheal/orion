-- Approval module tables

CREATE TABLE IF NOT EXISTS approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    req_by_id VARCHAR(255) NOT NULL,
    req_by_name VARCHAR(255),
    template_id VARCHAR(255),
    current_level BIGINT DEFAULT 1,
    total_levels BIGINT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_id ON approval_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_created_at ON approval_requests(created_at DESC);

CREATE TABLE IF NOT EXISTS approval_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    approval_id VARCHAR(255) NOT NULL,
    level BIGINT NOT NULL,
    approver_id VARCHAR(255) NOT NULL,
    approver_name VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_approval_levels_tenant_id ON approval_levels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approval_levels_approval_id ON approval_levels(approval_id);

CREATE TABLE IF NOT EXISTS approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    approval_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor_id VARCHAR(255) NOT NULL,
    actor_name VARCHAR(255),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_approval_history_tenant_id ON approval_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_approval_id ON approval_history(approval_id);

CREATE TABLE IF NOT EXISTS approval_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    levels BIGINT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_approval_templates_tenant_id ON approval_templates(tenant_id);

CREATE TABLE IF NOT EXISTS approval_gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    run_id VARCHAR(255) NOT NULL,
    stage_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    actor_id VARCHAR(255),
    actor_name VARCHAR(255),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_approval_gates_tenant_id ON approval_gates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approval_gates_run_id ON approval_gates(run_id);
