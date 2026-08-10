-- Create execution_modes table for execution-mode-engine module
CREATE TABLE IF NOT EXISTS execution_modes (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    name VARCHAR(256) NOT NULL,
    mode VARCHAR(32) NOT NULL,
    timeout_ms BIGINT DEFAULT 30000,
    retries INTEGER DEFAULT 3,
    worker_pool INTEGER DEFAULT 1,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_execution_modes_tenant ON execution_modes(tenant_id);
