-- Change Request tables: change_requests, change_approvals, change_executions
CREATE TABLE IF NOT EXISTS change_requests (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'standard',
    risk_level VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    impact_scope TEXT,
    rollback_plan TEXT,
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    created_by VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS change_approvals (
    id UUID PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    approver_id VARCHAR(200) NOT NULL,
    decision VARCHAR(50) NOT NULL DEFAULT 'pending',
    comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS change_executions (
    id UUID PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_requests_tenant_id ON change_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_priority ON change_requests(risk_level);
CREATE INDEX IF NOT EXISTS idx_change_approvals_request_id ON change_approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_change_executions_request_id ON change_executions(request_id);
