CREATE TABLE IF NOT EXISTS graph_nodes (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	node_type VARCHAR(64) NOT NULL, properties JSONB DEFAULT '{}',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_graph_nodes_tenant ON graph_nodes(tenant_id, created_at);
