-- Migration 431: Lowcode Workflow Version Management
-- Creates table for workflow version snapshots

CREATE TABLE IF NOT EXISTS lowcode_workflow_version (
  id VARCHAR(100) PRIMARY KEY,
  workflow_id VARCHAR(100) NOT NULL REFERENCES lowcode_workflow_definition(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  version VARCHAR(50) NOT NULL,
  nodes TEXT NOT NULL DEFAULT '[]',
  edges TEXT NOT NULL DEFAULT '[]',
  commit_message TEXT,
  created_by VARCHAR(200) NOT NULL DEFAULT 'system',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lowcode_wf_ver_workflow_id ON lowcode_workflow_version(workflow_id);
CREATE INDEX IF NOT EXISTS idx_lowcode_wf_ver_created_at ON lowcode_workflow_version(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lowcode_wf_ver_workflow_version ON lowcode_workflow_version(workflow_id, version);
