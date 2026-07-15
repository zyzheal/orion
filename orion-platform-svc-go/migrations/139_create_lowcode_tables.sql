-- Lowcode module tables (auto-generated)

CREATE TABLE IF NOT EXISTS lowcode_flows (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    version VARCHAR(255) NOT NULL,
    nodes VARCHAR(255) NOT NULL,
    edges VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_lowcode_flows_tenant ON lowcode_flows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lowcode_flows_created ON lowcode_flows(created_at DESC);

CREATE TABLE IF NOT EXISTS lowcode_instances (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    workflow_id VARCHAR(255) NOT NULL,
    workflow_definition_id VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    variables VARCHAR(255) NOT NULL,
    input VARCHAR(255) NOT NULL,
    output VARCHAR(255) NOT NULL,
    current_node_id VARCHAR(255) NOT NULL,
    triggered_by VARCHAR(255) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_lowcode_instances_tenant ON lowcode_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lowcode_instances_created ON lowcode_instances(created_at DESC);

