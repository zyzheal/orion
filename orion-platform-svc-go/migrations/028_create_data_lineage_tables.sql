-- 001_create_data_lineage_tables.sql
CREATE TABLE IF NOT EXISTS data_lineages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lineage_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lineage_id UUID NOT NULL REFERENCES data_lineages(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- table, column, dataset, api, event
    properties JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lineage_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lineage_id UUID NOT NULL REFERENCES data_lineages(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES lineage_nodes(id),
    target_node_id UUID NOT NULL REFERENCES lineage_nodes(id),
    type VARCHAR(50) DEFAULT 'reads', -- reads, writes, transforms
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_data_lineages_tenant ON data_lineages(tenant_id);
CREATE INDEX idx_lineage_nodes_lineage ON lineage_nodes(lineage_id);
CREATE INDEX idx_lineage_relationships_lineage ON lineage_relationships(lineage_id);