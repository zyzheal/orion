-- Migration: 001_init.sql
-- Description: Initialize graph service tables for query history, topology cache, and configuration
-- Created: 2026-05-15
-- Note: Core graph data is stored in Neo4j; these tables provide audit and cache capabilities

-- Graph Query History: stores executed graph queries for auditing and debugging
CREATE TABLE IF NOT EXISTS graph_query_history (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64),
    user_id VARCHAR(64),
    query_type VARCHAR(32) NOT NULL DEFAULT 'cypher',
    cypher_query TEXT NOT NULL,
    query_params JSONB DEFAULT '{}',
    execution_time_ms INTEGER,
    result_count INTEGER,
    status VARCHAR(16) NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Graph Topology Cache: caches service topology for faster retrieval
CREATE TABLE IF NOT EXISTS graph_topology_cache (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64),
    topology_data JSONB NOT NULL,
    node_count INTEGER NOT NULL DEFAULT 0,
    edge_count INTEGER NOT NULL DEFAULT 0,
    cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(tenant_id)
);

-- Graph Configuration: stores graph service configuration
CREATE TABLE IF NOT EXISTS graph_config (
    key VARCHAR(128) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    tenant_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Graph Labels: stores white-listed node labels for security
CREATE TABLE IF NOT EXISTS graph_labels (
    id VARCHAR(64) PRIMARY KEY,
    label VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Graph Relationship Types: stores white-listed relationship types for security
CREATE TABLE IF NOT EXISTS graph_relationship_types (
    id VARCHAR(64) PRIMARY KEY,
    rel_type VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX idx_graph_query_history_tenant ON graph_query_history(tenant_id);
CREATE INDEX idx_graph_query_history_user ON graph_query_history(user_id);
CREATE INDEX idx_graph_query_history_created ON graph_query_history(created_at DESC);
CREATE INDEX idx_graph_query_history_status ON graph_query_history(status);
CREATE INDEX idx_graph_topology_cache_tenant ON graph_topology_cache(tenant_id);
CREATE INDEX idx_graph_topology_cache_expires ON graph_topology_cache(expires_at);
CREATE INDEX idx_graph_config_tenant ON graph_config(tenant_id);
CREATE INDEX idx_graph_labels_enabled ON graph_labels(enabled);
CREATE INDEX idx_graph_relationship_types_enabled ON graph_relationship_types(enabled);

-- Comments for documentation
COMMENT ON TABLE graph_query_history IS 'Stores executed graph queries for auditing and debugging';
COMMENT ON TABLE graph_topology_cache IS 'Caches service topology for faster retrieval';
COMMENT ON TABLE graph_config IS 'Stores graph service configuration';
COMMENT ON TABLE graph_labels IS 'White-listed node labels for security (Cypher injection prevention)';
COMMENT ON TABLE graph_relationship_types IS 'White-listed relationship types for security (Cypher injection prevention)';

-- Enable Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE graph_query_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_topology_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_relationship_types ENABLE ROW LEVEL SECURITY;

-- Insert default allowed labels
INSERT INTO graph_labels (id, label, description, enabled) VALUES
    (gen_random_uuid()::text, 'Service', 'Service node in topology', true),
    (gen_random_uuid()::text, 'Pipeline', 'Pipeline node', true),
    (gen_random_uuid()::text, 'Environment', 'Environment node', true),
    (gen_random_uuid()::text, 'Artifact', 'Artifact node', true),
    (gen_random_uuid()::text, 'Deployment', 'Deployment node', true)
ON CONFLICT (label) DO NOTHING;

-- Insert default allowed relationship types
INSERT INTO graph_relationship_types (id, rel_type, description, enabled) VALUES
    (gen_random_uuid()::text, 'DEPENDS_ON', 'Service dependency relationship', true),
    (gen_random_uuid()::text, 'CONNECTS_TO', 'General connection relationship', true),
    (gen_random_uuid()::text, 'DEPLOYED_IN', 'Deployment relationship', true),
    (gen_random_uuid()::text, 'BUILDS', 'Build relationship', true),
    (gen_random_uuid()::text, 'RUNS_IN', 'Runtime environment relationship', true)
ON CONFLICT (rel_type) DO NOTHING;