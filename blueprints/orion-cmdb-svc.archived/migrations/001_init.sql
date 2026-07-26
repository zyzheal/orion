-- Migration: 001_init.sql
-- Description: Initialize CMDB service tables for configuration management database
-- Created: 2026-05-15

-- CMDB Nodes table: stores configuration items (CIs)
CREATE TABLE IF NOT EXISTS cmdb_nodes (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'service',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    application_id VARCHAR(64),
    parent_id VARCHAR(64),
    attributes JSONB NOT NULL DEFAULT '{}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    description TEXT,
    owner_id VARCHAR(64),
    environment VARCHAR(32) NOT NULL DEFAULT 'production',
    tenant_id VARCHAR(64),
    k8s_resource_name VARCHAR(255),
    k8s_namespace VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- CMDB Applications table: stores application definitions
CREATE TABLE IF NOT EXISTS cmdb_applications (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL,
    description TEXT,
    owner_id VARCHAR(64) NOT NULL,
    team_ids TEXT[] NOT NULL DEFAULT '{}',
    node_ids TEXT[] NOT NULL DEFAULT '{}',
    dependency_ids TEXT[] NOT NULL DEFAULT '{}',
    business_line VARCHAR(128),
    environment VARCHAR(32) NOT NULL DEFAULT 'production',
    tenant_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- CMDB Topology table: stores relationship graph between nodes
CREATE TABLE IF NOT EXISTS cmdb_topology (
    id VARCHAR(64) PRIMARY KEY,
    source_node_id VARCHAR(64) NOT NULL,
    target_node_id VARCHAR(64) NOT NULL,
    relation_type VARCHAR(32) NOT NULL DEFAULT 'depends_on',
    attributes JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- CMDB Reconciliations table: stores reconciliation results
CREATE TABLE IF NOT EXISTS cmdb_reconciliations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    reconciliation_type VARCHAR(32) NOT NULL DEFAULT 'manual',
    status VARCHAR(32) NOT NULL DEFAULT 'synced',
    diffs JSONB NOT NULL DEFAULT '[]',
    reconciled_count INTEGER NOT NULL DEFAULT 0,
    drift_count INTEGER NOT NULL DEFAULT 0,
    executor_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- CMDB Events table: stores configuration change events
CREATE TABLE IF NOT EXISTS cmdb_events (
    id VARCHAR(64) PRIMARY KEY,
    node_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}',
    executor_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX idx_cmdb_nodes_type ON cmdb_nodes(type);
CREATE INDEX idx_cmdb_nodes_status ON cmdb_nodes(status);
CREATE INDEX idx_cmdb_nodes_application ON cmdb_nodes(application_id);
CREATE INDEX idx_cmdb_nodes_environment ON cmdb_nodes(environment);
CREATE INDEX idx_cmdb_nodes_tenant ON cmdb_nodes(tenant_id);
CREATE INDEX idx_cmdb_nodes_k8s ON cmdb_nodes(k8s_resource_name, k8s_namespace);

CREATE INDEX idx_cmdb_applications_code ON cmdb_applications(code);
CREATE INDEX idx_cmdb_applications_tenant ON cmdb_applications(tenant_id);

CREATE INDEX idx_cmdb_topology_source ON cmdb_topology(source_node_id);
CREATE INDEX idx_cmdb_topology_target ON cmdb_topology(target_node_id);

CREATE INDEX idx_cmdb_reconciliations_status ON cmdb_reconciliations(status);
CREATE INDEX idx_cmdb_reconciliations_created ON cmdb_reconciliations(created_at DESC);

CREATE INDEX idx_cmdb_events_node ON cmdb_events(node_id);
CREATE INDEX idx_cmdb_events_type ON cmdb_events(event_type);
CREATE INDEX idx_cmdb_events_created ON cmdb_events(created_at DESC);

-- Foreign key constraints
ALTER TABLE cmdb_topology ADD CONSTRAINT fk_topology_source FOREIGN KEY (source_node_id) REFERENCES cmdb_nodes(id) ON DELETE CASCADE;
ALTER TABLE cmdb_topology ADD CONSTRAINT fk_topology_target FOREIGN KEY (target_node_id) REFERENCES cmdb_nodes(id) ON DELETE CASCADE;

-- Comments for documentation
COMMENT ON TABLE cmdb_nodes IS 'CMDB configuration items - stores infrastructure and application components';
COMMENT ON TABLE cmdb_applications IS 'Application definitions with owners, teams, and dependencies';
COMMENT ON TABLE cmdb_topology IS 'Relationship graph between CMDB nodes';
COMMENT ON TABLE cmdb_reconciliations IS 'Reconciliation results comparing CMDB state with actual infrastructure';
COMMENT ON TABLE cmdb_events IS 'Configuration change event log for auditing';

-- Enable Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE cmdb_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_topology ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_events ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS (requires app-specific implementation)
-- Example: CREATE POLICY cmdb_nodes_tenant_policy ON cmdb_nodes USING (tenant_id = current_setting('app.tenant_id', true));