-- Migration 428: Create infrastructure connectors table
-- Tables: infrastructure_connectors
-- Date: 2026-07-03

-- Infrastructure Connectors Table
CREATE TABLE IF NOT EXISTS infrastructure_connectors (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    type VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'disconnected',
    endpoint VARCHAR(512),
    credentials JSONB,
    timeout_ms INTEGER DEFAULT 5000,
    max_retries INTEGER DEFAULT 5,
    metadata JSONB DEFAULT '{}',
    last_connected_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    reconnect_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_infra_connectors_tenant ON infrastructure_connectors (tenant_id);
CREATE INDEX idx_infra_connectors_type ON infrastructure_connectors (type);
CREATE INDEX idx_infra_connectors_status ON infrastructure_connectors (status);
CREATE UNIQUE INDEX idx_infra_connectors_tenant_name ON infrastructure_connectors (tenant_id, name);

COMMENT ON TABLE infrastructure_connectors IS 'Infrastructure connectors (AWS/Azure/GCP/K8s/Docker/VMware)';
