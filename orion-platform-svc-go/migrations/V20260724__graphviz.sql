-- V20260724__graphviz.sql
-- Migration: GraphViz graph visualization engine tables

CREATE TABLE IF NOT EXISTS graphviz_graphs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_id VARCHAR(50),
    direction VARCHAR(10) DEFAULT 'TB',
    layout VARCHAR(20) DEFAULT 'dot',
    nodes_json TEXT,
    links_json TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_graphviz_graphs_tenant ON graphviz_graphs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_graphviz_graphs_template ON graphviz_graphs(template_id);
CREATE INDEX IF NOT EXISTS idx_graphviz_graphs_created ON graphviz_graphs(created_at);

-- GraphViz nodes table (normalized storage for individual nodes)
CREATE TABLE IF NOT EXISTS graphviz_nodes (
    id VARCHAR(36) PRIMARY KEY,
    graph_id VARCHAR(36) NOT NULL REFERENCES graphviz_graphs(id) ON DELETE CASCADE,
    tenant_id VARCHAR(36) NOT NULL,
    label VARCHAR(255) NOT NULL,
    node_type VARCHAR(50),
    shape VARCHAR(30),
    color VARCHAR(20),
    tooltip TEXT,
    "image" TEXT,
    attrs JSONB,
    position_x DOUBLE PRECISION,
    position_y DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_graphviz_nodes_graph ON graphviz_nodes(graph_id);
CREATE INDEX IF NOT EXISTS idx_graphviz_nodes_tenant ON graphviz_nodes(tenant_id);

-- GraphViz links table (normalized storage for individual edges)
CREATE TABLE IF NOT EXISTS graphviz_links (
    id VARCHAR(36) PRIMARY KEY,
    graph_id VARCHAR(36) NOT NULL REFERENCES graphviz_graphs(id) ON DELETE CASCADE,
    tenant_id VARCHAR(36) NOT NULL,
    source_id VARCHAR(36) NOT NULL,
    target_id VARCHAR(36) NOT NULL,
    label VARCHAR(255),
    link_type VARCHAR(50),
    directed BOOLEAN DEFAULT TRUE,
    style VARCHAR(20),
    color VARCHAR(20),
    attrs JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_graphviz_links_graph ON graphviz_links(graph_id);
CREATE INDEX IF NOT EXISTS idx_graphviz_links_source ON graphviz_links(source_id);
CREATE INDEX IF NOT EXISTS idx_graphviz_links_target ON graphviz_links(target_id);
CREATE INDEX IF NOT EXISTS idx_graphviz_links_tenant ON graphviz_links(tenant_id);
