-- Migration 430: Create infrastructure network policies table
-- Tables: infrastructure_network_policies
-- Date: 2026-07-03

-- Infrastructure Network Policies Table
CREATE TABLE IF NOT EXISTS infrastructure_network_policies (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    sandbox_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    namespace VARCHAR(128) NOT NULL,
    labels JSONB DEFAULT '{}',
    annotations JSONB DEFAULT '{}',
    ingress_rules JSONB DEFAULT '[]',
    egress_rules JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_infra_network_policies_tenant ON infrastructure_network_policies (tenant_id);
CREATE INDEX idx_infra_network_policies_sandbox ON infrastructure_network_policies (sandbox_id);
CREATE INDEX idx_infra_network_policies_namespace ON infrastructure_network_policies (namespace);

COMMENT ON TABLE infrastructure_network_policies IS 'Network policies for sandbox isolation';
