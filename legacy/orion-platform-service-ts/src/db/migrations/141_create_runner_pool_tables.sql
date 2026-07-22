-- Migration 141: Runner Pool and Runner Jobs (GAP-CN-07)
--
-- Support for remote runner/agent management:
-- - runners: Remote build runners with labels, capacity tracking, heartbeat
-- - runner_jobs: Tracks tasks dispatched to remote runners

CREATE TABLE IF NOT EXISTS runners (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  name            VARCHAR(200) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'online',  -- online, offline, busy, draining
  labels          TEXT[] NOT NULL DEFAULT '{}',           -- e.g., {'linux', 'docker', 'gpu'}
  max_concurrent  INTEGER NOT NULL DEFAULT 1,
  current_jobs    INTEGER NOT NULL DEFAULT 0,
  last_heartbeat  TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata        JSONB NOT NULL DEFAULT '{}',            -- {os, arch, version, ...}
  endpoint        VARCHAR(500),                           -- Runner HTTP endpoint
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, name)
);

CREATE INDEX idx_runners_tenant ON runners(tenant_id);
CREATE INDEX idx_runners_status ON runners(status);
CREATE INDEX idx_runners_labels ON runners USING GIN(labels);
CREATE INDEX idx_runners_heartbeat ON runners(last_heartbeat);

CREATE TABLE IF NOT EXISTS runner_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runner_id   UUID NOT NULL REFERENCES runners(id) ON DELETE CASCADE,
  task_id     VARCHAR(100) NOT NULL,
  stage_id    VARCHAR(100),
  run_id      VARCHAR(100),
  tenant_id   UUID NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, cancelled
  result      JSONB,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_runner_jobs_runner ON runner_jobs(runner_id);
CREATE INDEX idx_runner_jobs_task ON runner_jobs(task_id);
CREATE INDEX idx_runner_jobs_status ON runner_jobs(status);
CREATE INDEX idx_runner_jobs_tenant ON runner_jobs(tenant_id);

-- Rollback:
-- DROP TABLE IF EXISTS runner_jobs;
-- DROP TABLE IF EXISTS runners;
