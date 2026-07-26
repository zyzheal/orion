-- Migration: 001_init_visor_tables.sql
-- Visor Service - 运维平台代理表结构
-- 用途: 本地缓存/审计日志(代理服务本身的数据)
-- 注意: Visor后端数据由Java服务管理,本服务只做代理

-- 主机信息缓存表
CREATE TABLE IF NOT EXISTS visor_hosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visor_id VARCHAR(255) UNIQUE NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    ip VARCHAR(45) NOT NULL,
    port INTEGER DEFAULT 22,
    username VARCHAR(255),
    status VARCHAR(50) DEFAULT 'offline',
    os VARCHAR(100),
    cpu INTEGER,
    memory INTEGER,
    disk INTEGER,
    last_ping_at TIMESTAMP WITH TIME ZONE,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 脚本缓存表
CREATE TABLE IF NOT EXISTS visor_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visor_id VARCHAR(255) UNIQUE NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'shell',
    created_by VARCHAR(255),
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 任务执行记录表
CREATE TABLE IF NOT EXISTS visor_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visor_id VARCHAR(255) UNIQUE NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    host_ids TEXT[] DEFAULT '{}',
    script_id VARCHAR(255),
    script_content TEXT,
    script_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    output TEXT,
    error TEXT,
    created_by VARCHAR(255),
    timeout INTEGER DEFAULT 300,
    executed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 终端会话表
CREATE TABLE IF NOT EXISTS visor_terminal_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visor_id VARCHAR(255) UNIQUE NOT NULL,
    host_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    disconnected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API请求审计日志表
CREATE TABLE IF NOT EXISTS visor_api_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    user_id VARCHAR(255),
    method VARCHAR(10) NOT NULL,
    path VARCHAR(500) NOT NULL,
    request_body TEXT,
    response_status INTEGER,
    response_body TEXT,
    visor_backend_url VARCHAR(500),
    duration_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_visor_hosts_tenant ON visor_hosts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visor_hosts_visor_id ON visor_hosts(visor_id);
CREATE INDEX IF NOT EXISTS idx_visor_scripts_tenant ON visor_scripts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visor_tasks_tenant ON visor_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visor_tasks_status ON visor_tasks(status);
CREATE INDEX IF NOT EXISTS idx_visor_tasks_visor_id ON visor_tasks(visor_id);
CREATE INDEX IF NOT EXISTS idx_visor_terminal_sessions_user ON visor_terminal_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_visor_terminal_sessions_status ON visor_terminal_sessions(status);
CREATE INDEX IF NOT EXISTS idx_visor_api_logs_tenant ON visor_api_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visor_api_logs_created ON visor_api_logs(created_at);

-- 行安全策略
ALTER TABLE visor_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE visor_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE visor_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE visor_terminal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visor_api_logs ENABLE ROW LEVEL SECURITY;

-- RLS策略(租户隔离)
CREATE POLICY "visor_hosts_tenant_isolation" ON visor_hosts
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY "visor_scripts_tenant_isolation" ON visor_scripts
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY "visor_tasks_tenant_isolation" ON visor_tasks
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

-- 注意: terminal_sessions 和 api_logs 不需要租户隔离(系统级)