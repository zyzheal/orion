-- Ai-Agents module tables (auto-generated)

CREATE TABLE IF NOT EXISTS a_i_agents (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    scenario VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    max_concurrency BIGINT NOT NULL,
    timeout_ms BIGINT NOT NULL,
    max_retries BIGINT NOT NULL,
    backoff_ms BIGINT NOT NULL,
    required_tools VARCHAR(255) NOT NULL,
    required_permissions VARCHAR(255) NOT NULL,
    model_config VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_a_i_agents_tenant ON a_i_agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_a_i_agents_created ON a_i_agents(created_at DESC);

CREATE TABLE IF NOT EXISTS agent_audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    agent_id VARCHAR(255) NOT NULL,
    context VARCHAR(255) NOT NULL,
    input VARCHAR(255) NOT NULL,
    output VARCHAR(255) NOT NULL,
    duration_ms BIGINT NOT NULL,
    input_tokens BIGINT NOT NULL,
    output_tokens BIGINT NOT NULL,
    total_tokens BIGINT NOT NULL,
    success BOOLEAN NOT NULL,
    error VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_tenant ON agent_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_created ON agent_audit_logs(created_at DESC);

