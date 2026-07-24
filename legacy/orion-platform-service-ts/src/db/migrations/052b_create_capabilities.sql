-- 052_create_capabilities.sql
-- Capability Engine - 能力树与能力映射
-- Created: 2026-05-19

-- Capability 能力定义表
CREATE TABLE IF NOT EXISTS capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capability_id VARCHAR(100) NOT NULL UNIQUE,  -- 唯一能力标识，如 "chatops.command.execute"
    name VARCHAR(200) NOT NULL,                   -- 能力名称
    description TEXT,                             -- 能力描述
    category VARCHAR(50) NOT NULL,                -- 分类: chatops, pipeline, deployment, config, admin...
    parent_capability_id VARCHAR(100),            -- 父能力（用于能力树）
    risk_level INTEGER NOT NULL DEFAULT 1,        -- 风险等级 1-4 (4=最高风险)
    requires_approval BOOLEAN NOT NULL DEFAULT false,  -- 是否需要审批
    approval_role VARCHAR(50),                    -- 审批所需角色
    metadata JSONB DEFAULT '{}',                  -- 扩展字段: env_requirements, tags...
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_capabilities_category ON capabilities(category);
CREATE INDEX idx_capabilities_parent ON capabilities(parent_capability_id);
CREATE INDEX idx_capabilities_risk_level ON capabilities(risk_level);

-- Capability 角色映射表（哪些角色拥有哪些能力）
CREATE TABLE IF NOT EXISTS capability_role_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capability_id VARCHAR(100) NOT NULL REFERENCES capabilities(capability_id) ON DELETE CASCADE,
    role_name VARCHAR(100) NOT NULL REFERENCES roles(name) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES users(id),
    UNIQUE(capability_id, role_name)
);

CREATE INDEX idx_cap_mappings_cap ON capability_role_mappings(capability_id);
CREATE INDEX idx_cap_mappings_role ON capability_role_mappings(role_name);

-- Capability 用户直接映射（绕过角色）
CREATE TABLE IF NOT EXISTS capability_user_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capability_id VARCHAR(100) NOT NULL REFERENCES capabilities(capability_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ,  -- 临时权限过期时间
    UNIQUE(capability_id, user_id)
);

CREATE INDEX idx_cap_user_cap ON capability_user_mappings(capability_id);
CREATE INDEX idx_cap_user_user ON capability_user_mappings(user_id);
CREATE INDEX idx_cap_user_expires ON capability_user_mappings(expires_at) WHERE expires_at IS NOT NULL;

-- ChatOps 命令能力映射表
CREATE TABLE IF NOT EXISTS chatops_command_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_name VARCHAR(100) NOT NULL,           -- ChatOps 命令名
    command_action VARCHAR(50) NOT NULL,          -- 命令动作: execute, config_change, login...
    capability_id VARCHAR(100) NOT NULL REFERENCES capabilities(capability_id) ON DELETE CASCADE,
    environment_suffix VARCHAR(20),               -- 环境后缀，如 "_prod" 表示生产环境需要额外权限
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(command_name, command_action, environment_suffix)
);

CREATE INDEX idx_chatops_command ON chatops_command_capabilities(command_name);

-- 审计日志：能力权限变更
CREATE TABLE IF NOT EXISTS capability_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    target_type VARCHAR(20) NOT NULL,  -- 'role', 'user', 'command_mapping'
    target_id VARCHAR(100) NOT NULL,   -- role_name 或 user_id 或 command_name
    action VARCHAR(20) NOT NULL,       -- 'grant', 'revoke', 'assign'
    capability_id VARCHAR(100) NOT NULL,
    reason TEXT,
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cap_audit_user ON capability_audit_logs(user_id);
CREATE INDEX idx_cap_audit_cap ON capability_audit_logs(capability_id);

-- 注释
COMMENT ON TABLE capabilities IS 'Capability 能力定义表 - 能力树结构';
COMMENT ON COLUMN capabilities.risk_level IS '风险等级: 1=低风险, 2=中风险, 3=高风险, 4=最高风险';
COMMENT ON TABLE capability_role_mappings IS 'Capability 角色映射 - 哪些角色拥有哪些能力';
COMMENT ON TABLE capability_user_mappings IS 'Capability 用户映射 - 用户直接拥有的能力（临时或永久）';
COMMENT ON TABLE chatops_command_capabilities IS 'ChatOps 命令能力映射 - 命令到能力的关联';