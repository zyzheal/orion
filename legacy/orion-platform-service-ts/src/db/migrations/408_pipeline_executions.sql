-- Migration 408: Pipeline Executions
-- Persists PipelineEngine execution state for crash recovery
-- Tracks pending/running/completed stage sets per pipeline run

CREATE TABLE IF NOT EXISTS pipeline_executions (
  run_id          UUID PRIMARY KEY REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  status          VARCHAR(20) NOT NULL DEFAULT 'running',
  pending_stages  JSONB NOT NULL DEFAULT '[]',
  running_stages  JSONB NOT NULL DEFAULT '[]',
  completed_stages JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_executions_tenant ON pipeline_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_executions_pipeline ON pipeline_executions(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_executions_status ON pipeline_executions(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_executions_created_at ON pipeline_executions(created_at DESC);

-- Row Level Security
ALTER TABLE pipeline_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_pipeline_executions ON pipeline_executions
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );
