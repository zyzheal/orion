CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    definition_id UUID,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    requested_by VARCHAR(255),
    current_step INT NOT NULL DEFAULT 0,
    total_steps INT NOT NULL DEFAULT 1,
    required_approvals INT NOT NULL DEFAULT 1,
    result JSONB,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approvals_tenant_id ON approvals(tenant_id);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_resource ON approvals(resource_type, resource_id);

CREATE TABLE IF NOT EXISTS approval_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id UUID NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
    step_index INT NOT NULL,
    approver_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    comment TEXT,
    acted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_approval_steps_approval_id ON approval_steps(approval_id);
