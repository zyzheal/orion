-- Orion Plugin Service Database Initialization
-- Initial migration for plugin service

-- Plugin execution tracking table
CREATE TABLE IF NOT EXISTS plugin_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id VARCHAR(255) NOT NULL,
    plugin_name VARCHAR(255) NOT NULL,
    plugin_version VARCHAR(100),
    execution_id VARCHAR(255) UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plugin audit log table
CREATE TABLE IF NOT EXISTS plugin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    task_id VARCHAR(255),
    plugin_id VARCHAR(255) NOT NULL,
    plugin_name VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    outcome VARCHAR(50) NOT NULL,
    duration_ms INTEGER,
    user_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plugin marketplace table
CREATE TABLE IF NOT EXISTS plugin_marketplace (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    version VARCHAR(100) NOT NULL,
    author VARCHAR(255),
    repository_url VARCHAR(500),
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    downloads INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    is_verified BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    security_scan_result JSONB,
    dependencies JSONB DEFAULT '[]',
    manifest JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plugin configurations table
CREATE TABLE IF NOT EXISTS plugin_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255),
    config_key VARCHAR(255) NOT NULL,
    config_value JSONB,
    is_encrypted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(plugin_id, tenant_id, config_key)
);

-- Plugin sandbox sessions table
CREATE TABLE IF NOT EXISTS plugin_sandbox_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    plugin_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    resources JSONB DEFAULT '{"cpu": "100m", "memory": "128Mi"}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    cleaned_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_plugin_executions_plugin_id ON plugin_executions(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_executions_execution_id ON plugin_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_plugin_executions_status ON plugin_executions(status);
CREATE INDEX IF NOT EXISTS idx_plugin_executions_started_at ON plugin_executions(started_at);

CREATE INDEX IF NOT EXISTS idx_plugin_audit_logs_tenant_id ON plugin_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plugin_audit_logs_task_id ON plugin_audit_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_plugin_audit_logs_plugin_id ON plugin_audit_logs(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_audit_logs_created_at ON plugin_audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_name ON plugin_marketplace(name);
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_category ON plugin_marketplace(category);
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_tags ON plugin_marketplace USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_plugin_configs_plugin_id ON plugin_configs(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_configs_tenant_id ON plugin_configs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_plugin_sandbox_sessions_session_id ON plugin_sandbox_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_plugin_sandbox_sessions_plugin_id ON plugin_sandbox_sessions(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_sandbox_sessions_status ON plugin_sandbox_sessions(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_plugin_executions_updated_at
    BEFORE UPDATE ON plugin_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_marketplace_updated_at
    BEFORE UPDATE ON plugin_marketplace
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_configs_updated_at
    BEFORE UPDATE ON plugin_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create sequence for audit log if not exists
CREATE SEQUENCE IF NOT EXISTS plugin_audit_log_id_seq;