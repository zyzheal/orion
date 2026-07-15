-- Mcp module tables (auto-generated)

CREATE TABLE IF NOT EXISTS m_c_p_servers (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_m_c_p_servers_tenant ON m_c_p_servers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_m_c_p_servers_created ON m_c_p_servers(created_at DESC);

