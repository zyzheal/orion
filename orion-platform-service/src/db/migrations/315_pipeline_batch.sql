-- Migration 315: Pipeline Batch Execution (Phase Groups)
-- Creates tables for pipeline phase groups and phase batch runs.
-- Design doc: docs/reports/upgrade-detail-pipeline-batch-execution.md

-- Pipeline Phase Group (batch execution orchestration)
CREATE TABLE IF NOT EXISTS pipeline_phase_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  pipeline_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  batch_strategy VARCHAR(32) NOT NULL,  -- 'percentage' | 'count' | 'label'
  batch_config JSONB NOT NULL,          -- e.g. [10, 50, 100] or [100, 200, '*']
  gate_type VARCHAR(32),                -- 'auto' | 'manual' | null
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  current_batch INTEGER DEFAULT 0,
  created_by VARCHAR(128),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Pipeline Batch Run records
CREATE TABLE IF NOT EXISTS pipeline_batch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  group_id UUID NOT NULL REFERENCES pipeline_phase_groups(id) ON DELETE CASCADE,
  batch_index INTEGER NOT NULL,
  batch_size VARCHAR(32) NOT NULL,      -- '10%' or '100' or '*'
  status VARCHAR(32) NOT NULL DEFAULT 'pending',  -- pending/running/completed/failed/rolled_back/skipped
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  executor_id VARCHAR(128),
  result JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_phase_groups_tenant ON pipeline_phase_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phase_groups_pipeline ON pipeline_phase_groups(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_phase_groups_status ON pipeline_phase_groups(status);
CREATE INDEX IF NOT EXISTS idx_batch_runs_tenant ON pipeline_batch_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_batch_runs_group ON pipeline_batch_runs(group_id);
CREATE INDEX IF NOT EXISTS idx_batch_runs_status ON pipeline_batch_runs(status);

-- RLS multi-tenant isolation
ALTER TABLE pipeline_phase_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_phase_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pipeline_phase_groups USING (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE pipeline_batch_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_batch_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pipeline_batch_runs USING (tenant_id = current_setting('app.current_tenant_id', true));
