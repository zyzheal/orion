-- Create middleware config tables for middleware module
CREATE TABLE IF NOT EXISTS middleware_configs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    name VARCHAR(256) NOT NULL,
    timeout_ms BIGINT DEFAULT 30000,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_middleware_configs_tenant ON middleware_configs(tenant_id, name);
