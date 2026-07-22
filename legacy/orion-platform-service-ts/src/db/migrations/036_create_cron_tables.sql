-- Migration 036: Cron Scheduler

CREATE TABLE IF NOT EXISTS cron_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL UNIQUE,
  schedule        VARCHAR(100) NOT NULL,
  handler         VARCHAR(200) NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  last_run_status VARCHAR(20),
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cron_jobs_enabled ON cron_jobs(enabled) WHERE enabled = true;

CREATE TABLE IF NOT EXISTS cron_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES cron_jobs(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'running',
  result          JSONB,
  error_message   TEXT
);
CREATE INDEX idx_cron_executions_job ON cron_executions(job_id);
CREATE INDEX idx_cron_executions_status ON cron_executions(status);
CREATE INDEX idx_cron_executions_started ON cron_executions(started_at DESC);

-- Rollback:
-- DROP TABLE IF EXISTS cron_executions, cron_jobs;
