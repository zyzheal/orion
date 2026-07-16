-- Migration 316: Pipeline Execution Control
-- Creates tables for pipeline pause/resume logs and execution checkpoints.
-- Design doc: docs/reports/upgrade-detail-pipeline-execution-control.md

-- Pipeline Pause/Resume Log
CREATE TABLE IF NOT EXISTS pipeline_pause_resume_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  run_id VARCHAR(64) NOT NULL,
  action VARCHAR(32) NOT NULL,          -- 'pause' | 'resume' | 'abort' | 'retry' | 'restart'
  reason TEXT,
  operator VARCHAR(128),
  checkpoint_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Pipeline Execution Checkpoints
CREATE TABLE IF NOT EXISTS pipeline_execution_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  run_id VARCHAR(64) NOT NULL,
  step_id VARCHAR(64) NOT NULL,
  step_type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,          -- completed/failed/running
  checkpoint_data JSONB NOT NULL,       -- step intermediate state
  output_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pause_resume_log_tenant ON pipeline_pause_resume_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pause_resume_log_run ON pipeline_pause_resume_log(run_id);
CREATE INDEX IF NOT EXISTS idx_pause_resume_log_action ON pipeline_pause_resume_log(action);
CREATE INDEX IF NOT EXISTS idx_execution_checkpoints_tenant ON pipeline_execution_checkpoints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_execution_checkpoints_run ON pipeline_execution_checkpoints(run_id);
CREATE INDEX IF NOT EXISTS idx_execution_checkpoints_step ON pipeline_execution_checkpoints(step_id);
CREATE INDEX IF NOT EXISTS idx_execution_checkpoints_status ON pipeline_execution_checkpoints(status);

-- RLS multi-tenant isolation
ALTER TABLE pipeline_pause_resume_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_pause_resume_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pipeline_pause_resume_log USING (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE pipeline_execution_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_execution_checkpoints FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pipeline_execution_checkpoints USING (tenant_id = current_setting('app.current_tenant_id', true));
