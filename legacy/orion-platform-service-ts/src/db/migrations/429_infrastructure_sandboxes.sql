-- Migration 429: Create infrastructure sandboxes table
-- Tables: infrastructure_sandboxes
-- Date: 2026-07-03

-- Infrastructure Sandboxes Table
CREATE TABLE IF NOT EXISTS infrastructure_sandboxes (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name VARCHAR(128) NOT NULL,
    namespace VARCHAR(128) NOT NULL,
    isolation_status VARCHAR(32) NOT NULL DEFAULT 'unknown',
    network_policy_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_infra_sandboxes_tenant ON infrastructure_sandboxes (tenant_id);
CREATE INDEX idx_infra_sandboxes_namespace ON infrastructure_sandboxes (namespace);
CREATE INDEX idx_infra_sandboxes_isolation_status ON infrastructure_sandboxes (isolation_status);
CREATE UNIQUE INDEX idx_infra_sandboxes_tenant_name ON infrastructure_sandboxes (tenant_id, name);

COMMENT ON TABLE infrastructure_sandboxes IS 'Infrastructure sandboxes for network isolation';
