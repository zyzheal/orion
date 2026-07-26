-- Migration 001: Pipeline Service Core Tables
-- Creates all core tables for pipelines, stages, triggers, runs, stage results, and log entries
-- Version: 1.0.0

-- ==================== Pipelines ====================
CREATE TABLE IF NOT EXISTS pipelines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  project_id      UUID NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  env_template    JSONB DEFAULT '{}',
  created_by      VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipelines_tenant ON pipelines(tenant_id);
CREATE INDEX idx_pipelines_project ON pipelines(project_id);
CREATE INDEX idx_pipelines_status ON pipelines(status);
CREATE INDEX idx_pipelines_created_by ON pipelines(created_by);

-- ==================== Pipeline Stages ====================
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  type            VARCHAR(50) NOT NULL,
  command         TEXT NOT NULL,
  depends_on      JSONB NOT NULL DEFAULT '[]',
  env             JSONB DEFAULT '{}',
  timeout_ms      INTEGER,
  retries         INTEGER NOT NULL DEFAULT 0,
  continue_on_error BOOLEAN NOT NULL DEFAULT false,
  stage_order     INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);
CREATE INDEX idx_pipeline_stages_order ON pipeline_stages(pipeline_id, stage_order);

-- ==================== Pipeline Triggers ====================
CREATE TABLE IF NOT EXISTS pipeline_triggers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  type            VARCHAR(20) NOT NULL,
  cron            VARCHAR(100),
  events          JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_triggers_pipeline ON pipeline_triggers(pipeline_id);
CREATE INDEX idx_pipeline_triggers_type ON pipeline_triggers(type);

-- ==================== Pipeline Runs ====================
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id       UUID NOT NULL REFERENCES pipelines(id),
  tenant_id         UUID NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  current_stage     VARCHAR(255),
  stage_results     JSONB NOT NULL DEFAULT '{}',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at       TIMESTAMPTZ,
  triggered_by      VARCHAR(20) NOT NULL,
  triggered_by_user_id VARCHAR(255),
  error             TEXT,
  env_overrides     JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_runs_pipeline ON pipeline_runs(pipeline_id);
CREATE INDEX idx_pipeline_runs_tenant ON pipeline_runs(tenant_id);
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX idx_pipeline_runs_started ON pipeline_runs(started_at);
CREATE INDEX idx_pipeline_runs_finished ON pipeline_runs(finished_at);

-- ==================== Log Entries ====================
CREATE TABLE IF NOT EXISTS pipeline_log_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  stage_id        VARCHAR(255) NOT NULL,
  level           VARCHAR(10) NOT NULL DEFAULT 'info',
  message         TEXT NOT NULL,
  raw             TEXT,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_log_entries_run ON pipeline_log_entries(run_id);
CREATE INDEX idx_pipeline_log_entries_stage ON pipeline_log_entries(run_id, stage_id);
CREATE INDEX idx_pipeline_log_entries_level ON pipeline_log_entries(level);
CREATE INDEX idx_pipeline_log_entries_timestamp ON pipeline_log_entries(timestamp);

-- ==================== Migration Info ====================
CREATE TABLE IF NOT EXISTS pipeline_schema_migrations (
  version             VARCHAR(20) PRIMARY KEY,
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  description         TEXT
);

INSERT INTO pipeline_schema_migrations (version, description)
VALUES ('001', 'Initial pipeline service tables: pipelines, stages, triggers, runs, log_entries');
