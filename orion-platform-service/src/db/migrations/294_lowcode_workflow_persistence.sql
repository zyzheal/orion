-- Migration 294: WorkflowRepository to PostgreSQL
-- Creates tables for lowcode workflow definitions and instances

CREATE TABLE IF NOT EXISTS lowcode_workflow_definition (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  name VARCHAR(200) NOT NULL,
  description TEXT,
  version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  nodes TEXT NOT NULL DEFAULT '[]',
  edges TEXT NOT NULL DEFAULT '[]',
  created_by VARCHAR(200),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lowcode_wf_def_tenant ON lowcode_workflow_definition(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lowcode_wf_def_enabled ON lowcode_workflow_definition(enabled);
CREATE INDEX IF NOT EXISTS idx_lowcode_wf_def_created_at ON lowcode_workflow_definition(created_at DESC);

CREATE TABLE IF NOT EXISTS lowcode_workflow_instance (
  id VARCHAR(100) PRIMARY KEY,
  workflow_id VARCHAR(100) NOT NULL,
  workflow_definition_id VARCHAR(100) NOT NULL,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  current_node_id VARCHAR(200),
  variables TEXT NOT NULL DEFAULT '{}',
  history TEXT NOT NULL DEFAULT '[]',
  input TEXT DEFAULT '{}',
  output TEXT,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lowcode_wf_inst_workflow_id ON lowcode_workflow_instance(workflow_id);
CREATE INDEX IF NOT EXISTS idx_lowcode_wf_inst_def_id ON lowcode_workflow_instance(workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_lowcode_wf_inst_tenant ON lowcode_workflow_instance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lowcode_wf_inst_status ON lowcode_workflow_instance(status);
CREATE INDEX IF NOT EXISTS idx_lowcode_wf_inst_created_at ON lowcode_workflow_instance(created_at DESC);
