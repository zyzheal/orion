-- Migration 254: Decision Tree Nodes Persistence
-- Stores decision tree nodes in PostgreSQL instead of in-memory Map()
-- in DiagnosticDecisionTree.nodes

CREATE TABLE IF NOT EXISTS diagnostic_decision_tree_nodes (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_leaf BOOLEAN NOT NULL DEFAULT FALSE,
  branches JSONB NOT NULL DEFAULT '[]',
  root_cause JSONB,
  default_branch JSONB,
  parent_id VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_tree_nodes_tenant_id ON diagnostic_decision_tree_nodes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_decision_tree_nodes_parent_id ON diagnostic_decision_tree_nodes(parent_id);
