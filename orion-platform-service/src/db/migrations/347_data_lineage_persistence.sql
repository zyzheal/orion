-- Migration 347: Data Lineage Persistence
-- Tables: data_lineage_nodes, data_lineage_edges, data_lineage_records

CREATE TABLE IF NOT EXISTS data_lineage_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'dataset',
  description TEXT,
  pipeline_id VARCHAR(64),
  stage_id VARCHAR(64),
  schema_data JSONB,
  node_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lineage_nodes_tenant ON data_lineage_nodes(tenant_id);
CREATE INDEX idx_lineage_nodes_pipeline ON data_lineage_nodes(pipeline_id);
CREATE INDEX idx_lineage_nodes_type ON data_lineage_nodes(type);

CREATE TABLE IF NOT EXISTS data_lineage_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  from_node_id VARCHAR(64) NOT NULL,
  to_node_id VARCHAR(64) NOT NULL,
  relationship VARCHAR(32) NOT NULL DEFAULT 'produces',
  field_mapping JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lineage_edges_tenant ON data_lineage_edges(tenant_id);
CREATE INDEX idx_lineage_edges_from ON data_lineage_edges(from_node_id);
CREATE INDEX idx_lineage_edges_to ON data_lineage_edges(to_node_id);

CREATE TABLE IF NOT EXISTS data_lineage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  pipeline_id VARCHAR(64) NOT NULL,
  execution_id VARCHAR(64) NOT NULL,
  node_ids JSONB DEFAULT '[]',
  edge_ids JSONB DEFAULT '[]',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lineage_records_tenant ON data_lineage_records(tenant_id);
CREATE INDEX idx_lineage_records_pipeline ON data_lineage_records(pipeline_id);
