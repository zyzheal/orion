-- ChatOps Role Management Tables

-- ChatOps 角色表
CREATE TABLE IF NOT EXISTS chatops_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 角色-权限关联表 (角色拥有的 capability 列表)
CREATE TABLE IF NOT EXISTS chatops_role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES chatops_roles(id) ON DELETE CASCADE,
    permission VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(role_id, permission)
);

-- 用户-角色关联表
CREATE TABLE IF NOT EXISTS chatops_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    role_id UUID NOT NULL REFERENCES chatops_roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

-- 命令权限表 (命令与角色/环境的关联)
CREATE TABLE IF NOT EXISTS chatops_command_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command VARCHAR(100) NOT NULL,
    description TEXT,
    capability VARCHAR(200) NOT NULL,
    risk_level INT NOT NULL DEFAULT 1 CHECK (risk_level BETWEEN 1 AND 4),
    requires_approval BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(command, capability)
);

-- 命令-角色关联表
CREATE TABLE IF NOT EXISTS chatops_command_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_permission_id UUID NOT NULL REFERENCES chatops_command_permissions(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES chatops_roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(command_permission_id, role_id)
);

-- 环境权限表
CREATE TABLE IF NOT EXISTS chatops_environment_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    rate_limit INT DEFAULT 100,
    require_approval BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 环境-角色关联表
CREATE TABLE IF NOT EXISTS chatops_environment_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES chatops_environment_permissions(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES chatops_roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(environment_id, role_id)
);

-- 环境-命令关联表 (允许的命令)
CREATE TABLE IF NOT EXISTS chatops_environment_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES chatops_environment_permissions(id) ON DELETE CASCADE,
    command VARCHAR(100) NOT NULL,
    is_denied BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(environment_id, command, is_denied)
);

-- 初始化默认角色
INSERT INTO chatops_roles (name, description) VALUES
('运维管理员', '拥有全部 ChatOps 操作权限'),
('开发者', '开发/测试环境操作权限'),
('只读用户', '仅查看权限')
ON CONFLICT (name) DO NOTHING;

-- 初始化默认环境权限
INSERT INTO chatops_environment_permissions (environment, description, rate_limit, require_approval) VALUES
('prod', '生产环境', 10, true),
('staging', '预发环境', 50, false),
('dev', '开发环境', 100, false)
ON CONFLICT (environment) DO NOTHING;
