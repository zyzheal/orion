-- Migration #253: Create graph_nodes and graph_relationships tables
-- Graph service: knowledge graph for CMDB/service topology, node traversal, and relationships

-- Graph nodes table
CREATE TABLE IF NOT EXISTS graph_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    labels JSONB NOT NULL DEFAULT '[]',        -- node labels, e.g. ["Service", "Production"]
    properties JSONB NOT NULL DEFAULT '{}',    -- node properties, e.g. {"name": "api", "version": "1.0"}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for graph_nodes
CREATE INDEX IF NOT EXISTS idx_graph_nodes_tenant_id ON graph_nodes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_labels ON graph_nodes USING GIN (labels);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_tenant_labels ON graph_nodes (tenant_id, labels);

-- Graph relationships table (directed edges)
CREATE TABLE IF NOT EXISTS graph_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    type VARCHAR(128) NOT NULL,               -- relationship type, e.g. DEPENDS_ON, CONNECTS_TO, PARENT_OF
    start_node_id UUID NOT NULL,
    end_node_id UUID NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}',   -- edge properties, e.g. {"weight": 0.8, "since": "2026-01-01"}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_graph_rel_start FOREIGN KEY (start_node_id) REFERENCES graph_nodes (id) ON DELETE CASCADE,
    CONSTRAINT fk_graph_rel_end FOREIGN KEY (end_node_id) REFERENCES graph_nodes (id) ON DELETE CASCADE
);

-- Indexes for graph_relationships
CREATE INDEX IF NOT EXISTS idx_graph_relationships_tenant_id ON graph_relationships (tenant_id);
CREATE INDEX IF NOT EXISTS idx_graph_relationships_type ON graph_relationships (type);
CREATE INDEX IF NOT EXISTS idx_graph_relationships_start_node ON graph_relationships (start_node_id);
CREATE INDEX IF NOT EXISTS idx_graph_relationships_end_node ON graph_relationships (end_node_id);
CREATE INDEX IF NOT EXISTS idx_graph_relationships_start_end ON graph_relationships (start_node_id, end_node_id);

-- Unique constraint: prevent duplicate edges between same pair with same type
CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_relationships_unique_edge ON graph_relationships (type, start_node_id, end_node_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_graph_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_graph_nodes_updated_at
    BEFORE UPDATE ON graph_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_graph_updated_at();

CREATE TRIGGER trg_graph_relationships_updated_at
    BEFORE UPDATE ON graph_relationships
    FOR EACH ROW
    EXECUTE FUNCTION update_graph_updated_at();

-- Comments
COMMENT ON TABLE graph_nodes IS 'Knowledge graph nodes for service topology and CMDB relationships';
COMMENT ON TABLE graph_relationships IS 'Directed edges connecting graph nodes';
COMMENT ON COLUMN graph_nodes.labels IS 'JSON array of node labels for classification';
COMMENT ON COLUMN graph_nodes.properties IS 'JSON object of node properties';
COMMENT ON COLUMN graph_relationships.type IS 'Relationship type following Cypher convention: DEPENDS_ON, CONNECTS_TO, etc.';
