-- 164: ChatOps 审批配置表
-- 用于存储能力域的审批规则配置

CREATE TABLE IF NOT EXISTS chatops_approval_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    capability_id VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    approval_mode VARCHAR(20) DEFAULT 'strict',  -- 'strict'|'relaxed'|'log_only'
    approval_level INT DEFAULT 1,               -- 审批级数
    approver_roles JSONB DEFAULT '["super_admin"]',
    approver_users JSONB DEFAULT '[]',           -- 指定审批人
    proxy_roles JSONB DEFAULT '["admin"]',       -- 代理审批人
    proxy_users JSONB DEFAULT '[]',
    timeout_minutes INT DEFAULT 30,
    timeout_action VARCHAR(20) DEFAULT 'remind',  -- 'remind'|'auto_approve'|'auto_reject'|'escalate'
    second_timeout_minutes INT DEFAULT 120,
    second_timeout_action VARCHAR(20) DEFAULT 'escalate',
    environments JSONB DEFAULT '["prod"]',        -- 生效环境
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, capability_id)
);

CREATE INDEX idx_chatops_approval_configs_tenant ON chatops_approval_configs(tenant_id);
CREATE INDEX idx_chatops_approval_configs_capability ON chatops_approval_configs(capability_id);

-- 全局审批配置（不区分租户）
CREATE TABLE IF NOT EXISTS chatops_global_approval_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enabled BOOLEAN DEFAULT true,
    approval_mode VARCHAR(20) DEFAULT 'strict',
    default_timeout_minutes INT DEFAULT 30,
    default_timeout_action VARCHAR(20) DEFAULT 'remind',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 初始化全局配置（如果不存在）
INSERT INTO chatops_global_approval_config (id, enabled, approval_mode, default_timeout_minutes, default_timeout_action)
SELECT gen_random_uuid(), true, 'strict', 30, 'remind'
WHERE NOT EXISTS (SELECT 1 FROM chatops_global_approval_config);