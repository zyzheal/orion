-- Tool service migrations
-- 001: Create tool-related tables

CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    display_name VARCHAR(256),
    description TEXT,
    category VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,
    version VARCHAR(32) NOT NULL,
    config JSONB DEFAULT '{}',
    endpoint VARCHAR(512),
    auth_type VARCHAR(32) DEFAULT 'none',
    auth_config JSONB DEFAULT '{}',
    tags JSONB DEFAULT '[]',
    status VARCHAR(32) DEFAULT 'active',
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deprecated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tool_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    version VARCHAR(32) NOT NULL,
    config JSONB DEFAULT '{}',
    changelog TEXT,
    created_by VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tool_categories (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    display_name VARCHAR(256),
    description TEXT,
    icon VARCHAR(64),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tool_invocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    input JSONB DEFAULT '{}',
    output JSONB DEFAULT '{}',
    status VARCHAR(32) NOT NULL,
    error TEXT,
    duration BIGINT DEFAULT 0,
    called_by VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tools_tenant ON tools(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tools_name ON tools(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_tool_versions_tool ON tool_versions(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_invocations_tool ON tool_invocations(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_invocations_tenant ON tool_invocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tool_categories_tenant ON tool_categories(tenant_id);
