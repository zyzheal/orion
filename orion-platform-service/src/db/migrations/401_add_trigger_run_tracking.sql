-- Enhanced Pipeline Triggers - Run Tracking (Task 6)
-- Adds run tracking metadata to pipeline_triggers table.
-- Mirrors NeatLogic autoexec lastRunId/lastRunStatus/consecutiveFailures fields.

ALTER TABLE pipeline_triggers
  ADD COLUMN IF NOT EXISTS last_run_id VARCHAR(36),
  ADD COLUMN IF NOT EXISTS last_run_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pipeline_triggers_last_run
  ON pipeline_triggers(tenant_id, last_run_at);
