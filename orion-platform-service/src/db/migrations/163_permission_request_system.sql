-- Phase 4: Permission Request & Temporary Permission System
-- 163_permission_request_system.sql

-- 1. 临时权限授予记录表
CREATE TABLE IF NOT EXISTS chatops_temporary_permissions (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    capability_id VARCHAR(255) NOT NULL,
    environment_suffix VARCHAR(50),
    granted_by VARCHAR(255) NOT NULL, -- 'system' | 'approval:N' | user_id
    approval_id INTEGER REFERENCES approvals(id),
    ticket_id INTEGER REFERENCES tickets(id),
    reason TEXT,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by VARCHAR(255),
    revoke_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, capability_id, environment_suffix, expires_at)
);

CREATE INDEX idx_chatops_temp_perms_user ON chatops_temporary_permissions(user_id, tenant_id);
CREATE INDEX idx_chatops_temp_perms_expires ON chatops_temporary_permissions(expires_at);
CREATE INDEX idx_chatops_temp_perms_active ON chatops_temporary_permissions(user_id, capability_id)
    WHERE revoked_at IS NULL AND expires_at > NOW();

-- 2. 扩展 capability_user_mappings，增加 approval_id / ticket_id 关联
ALTER TABLE capability_user_mappings
    ADD COLUMN IF NOT EXISTS approval_id INTEGER REFERENCES approvals(id),
    ADD COLUMN IF NOT EXISTS ticket_id INTEGER REFERENCES tickets(id),
    ADD COLUMN IF NOT EXISTS reason TEXT;

-- 3. 权限申请工单扩展表（可选的专用扩展，挂载在通用 tickets 表之上）
CREATE TABLE IF NOT EXISTS permission_requests (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    capability_id VARCHAR(255) NOT NULL,
    environment_suffix VARCHAR(50),
    duration_hours INTEGER NOT NULL,
    requested_for_user_id VARCHAR(255) NOT NULL,
    capability_snapshot JSONB, -- 申请时的能力信息快照
    approved_capability_mapping_id INTEGER REFERENCES capability_user_mappings(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_permission_requests_ticket ON permission_requests(ticket_id);
CREATE INDEX idx_permission_requests_user ON permission_requests(requested_for_user_id);

-- 4. 权限审计日志
CREATE TABLE IF NOT EXISTS permission_audit_log (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'granted', 'revoked', 'expired', 'requested', 'approved', 'rejected'
    capability_id VARCHAR(255) NOT NULL,
    environment_suffix VARCHAR(50),
    actor_id VARCHAR(255), -- 执行操作的人（系统审批人等）
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_permission_audit_user ON permission_audit_log(user_id, created_at DESC);
CREATE INDEX idx_permission_audit_capability ON permission_audit_log(capability_id, created_at DESC);
