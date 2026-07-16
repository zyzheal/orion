-- Infrastructure module tables

CREATE TABLE IF NOT EXISTS infrastructure_connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255),
    credentials JSONB,
    timeout_ms INTEGER DEFAULT 30000,
    max_retries INTEGER DEFAULT 3,
    status VARCHAR(50) NOT NULL DEFAULT 'disconnected',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_infrastructure_connectors_tenant_id ON infrastructure_connectors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_infrastructure_connectors_type ON infrastructure_connectors(type);
CREATE INDEX IF NOT EXISTS idx_infrastructure_connectors_status ON infrastructure_connectors(status);

CREATE TABLE IF NOT EXISTS infrastructure_sandboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    namespace VARCHAR(255) NOT NULL,
    isolation_status VARCHAR(50) NOT NULL,
    network_policy_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_infrastructure_sandboxes_tenant_id ON infrastructure_sandboxes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_infrastructure_sandboxes_isolation_status ON infrastructure_sandboxes(isolation_status);

CREATE TABLE IF NOT EXISTS sandbox_network_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sandbox_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    namespace VARCHAR(255),
    labels JSONB,
    annotations JSONB,
    ingress_rules JSONB,
    egress_rules JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sandbox_network_policies_sandbox_id ON sandbox_network_policies(sandbox_id);
