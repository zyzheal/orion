-- Migration 384: Data Lineage Persistence
-- Purpose: Persist DataLineageService nodes, edges, and execution records to PostgreSQL
-- F001: data lineage graph storage, impact analysis, upstream/downstream queries

-- Lineage nodes table
CREATE TABLE IF NOT EXISTS data_lineage_nodes (
  id            VARCHAR(200) NOT NULL,
  tenant_id     UUID NOT NULL,
  name          VARCHAR(500) NOT NULL,
  type          VARCHAR(20) NOT NULL,                -- source | transform | sink | dataset | model
  description   TEXT,
  pipeline_id   VARCHAR(200),
  stage_id      VARCHAR(200),
  schema_data   JSONB NOT NULL DEFAULT '{}',
  node_metadata JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX idx_data_lineage_nodes_tenant ON data_lineage_nodes(tenant_id);
CREATE INDEX idx_data_lineage_nodes_pipeline ON data_lineage_nodes(pipeline_id);
CREATE INDEX idx_data_lineage_nodes_type ON data_lineage_nodes(type);
CREATE INDEX idx_data_lineage_nodes_created ON data_lineage_nodes(created_at DESC);

COMMENT ON COLUMN data_lineage_nodes.type IS 'Node type: source, transform, sink, dataset, model';
COMMENT ON COLUMN data_lineage_nodes.schema_data IS 'Column schema mapping (JSON object)';
COMMENT ON COLUMN data_lineage_nodes.node_metadata IS 'Arbitrary metadata (JSON object)';

-- Lineage edges table
CREATE TABLE IF NOT EXISTS data_lineage_edges (
  id            VARCHAR(200) NOT NULL,
  tenant_id     UUID NOT NULL,
  from_node_id  VARCHAR(200) NOT NULL REFERENCES data_lineage_nodes(id) ON DELETE CASCADE,
  to_node_id    VARCHAR(200) NOT NULL REFERENCES data_lineage_nodes(id) ON DELETE CASCADE,
  relationship  VARCHAR(20) NOT NULL,                -- produces | consumes | transforms | derives
  field_mapping JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX idx_data_lineage_edges_tenant ON data_lineage_edges(tenant_id);
CREATE INDEX idx_data_lineage_edges_from ON data_lineage_edges(from_node_id);
CREATE INDEX idx_data_lineage_edges_to ON data_lineage_edges(to_node_id);
CREATE INDEX idx_data_lineage_edges_rel ON data_lineage_edges(relationship);
CREATE INDEX idx_data_lineage_edges_created ON data_lineage_edges(created_at DESC);

COMMENT ON COLUMN data_lineage_edges.relationship IS 'Edge relationship: produces, consumes, transforms, derives';
COMMENT ON COLUMN data_lineage_edges.field_mapping IS 'Field-level mapping (JSON object, nullable)';

-- Lineage execution records table
CREATE TABLE IF NOT EXISTS data_lineage_records (
  id            UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  pipeline_id   VARCHAR(200) NOT NULL,
  execution_id  VARCHAR(200) NOT NULL,
  node_ids      JSONB NOT NULL DEFAULT '[]',
  edge_ids      JSONB NOT NULL DEFAULT '[]',
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX idx_data_lineage_records_tenant ON data_lineage_records(tenant_id);
CREATE INDEX idx_data_lineage_records_pipeline ON data_lineage_records(pipeline_id);
CREATE INDEX idx_data_lineage_records_execution ON data_lineage_records(execution_id);
CREATE INDEX idx_data_lineage_records_recorded ON data_lineage_records(recorded_at DESC);
CREATE INDEX idx_data_lineage_records_pipeline_recorded ON data_lineage_records(pipeline_id, recorded_at DESC);

COMMENT ON COLUMN data_lineage_records.node_ids IS 'Array of node IDs in this execution snapshot';
COMMENT ON COLUMN data_lineage_records.edge_ids IS 'Array of edge IDs in this execution snapshot';
