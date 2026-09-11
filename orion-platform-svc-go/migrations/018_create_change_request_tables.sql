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
-- 补齐 change_requests：115_create_config-mgmt-enhanced_tables.sql 的定义晚于 018_create_change_request_tables.sql，按序执行时表已存在
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS config_key VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS config_group VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS environment VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS change_type VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS old_value VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS new_value VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS reason VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS requester VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS execution_plan VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS approvals VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS required_approvals BIGINT NOT NULL, ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP WITH TIME ZONE, ADD COLUMN IF NOT EXISTS executed_by VARCHAR(255), ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE, ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255), ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMP WITH TIME ZONE, ADD COLUMN IF NOT EXISTS rolled_back_by VARCHAR(255), ADD COLUMN IF NOT EXISTS approvals_list TEXT NOT NULL, ADD COLUMN IF NOT EXISTS metadata JSONB, ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 补齐 change_requests：024_create_config_tables.sql 的定义晚于 018_create_change_request_tables.sql，按序执行时表已存在
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS config_id VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS requested_by VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255), ADD COLUMN IF NOT EXISTS reject_reason TEXT;


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
