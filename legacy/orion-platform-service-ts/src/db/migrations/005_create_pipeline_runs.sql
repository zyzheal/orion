-- Migration 005: Pipeline Runs & Stage Executions
-- Pipeline run history and stage execution records

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id   UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  trigger_type  VARCHAR(50) NOT NULL DEFAULT 'manual',
  trigger_by    UUID REFERENCES users(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  config_snapshot JSONB NOT NULL DEFAULT '{}',
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  duration_ms   BIGINT,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_runs_tenant ON pipeline_runs(tenant_id);
CREATE INDEX idx_pipeline_runs_pipeline ON pipeline_runs(pipeline_id);
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX idx_pipeline_runs_created ON pipeline_runs(created_at DESC);

-- Stage executions
CREATE TABLE IF NOT EXISTS stage_executions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  stage_id      UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  stage_name    VARCHAR(100) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  duration_ms   BIGINT,
  error_message TEXT,
  logs          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stage_executions_run ON stage_executions(run_id);
CREATE INDEX idx_stage_executions_status ON stage_executions(status);

-- Task executions (sub-stages within a stage)
CREATE TABLE IF NOT EXISTS task_executions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id  UUID NOT NULL REFERENCES stage_executions(id) ON DELETE CASCADE,
  task_name     VARCHAR(100) NOT NULL,
  task_type     VARCHAR(50) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  input         JSONB NOT NULL DEFAULT '{}',
  output        JSONB,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  duration_ms   BIGINT,
  error_message TEXT,
  logs          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_executions_execution ON task_executions(execution_id);
CREATE INDEX idx_task_executions_status ON task_executions(status);

-- Rollback:
-- DROP TABLE IF EXISTS task_executions, stage_executions, pipeline_runs;
