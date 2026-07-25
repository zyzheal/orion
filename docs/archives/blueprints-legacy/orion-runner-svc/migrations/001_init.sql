-- Migration 001: Runner Service Tables
-- Core tables for CI runner registration, job tracking, and execution history

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Runner registry
CREATE TABLE IF NOT EXISTS runners (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runner_id         VARCHAR(100) UNIQUE NOT NULL,
  tenant_id         UUID NOT NULL,
  name              VARCHAR(200) NOT NULL,
  labels            JSONB NOT NULL DEFAULT '[]',
  endpoint          VARCHAR(512) NOT NULL,
  max_concurrent    INTEGER NOT NULL DEFAULT 5,
  status            VARCHAR(20) NOT NULL DEFAULT 'online',
  metadata          JSONB NOT NULL DEFAULT '{}',
  last_heartbeat_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_runners_tenant ON runners(tenant_id);
CREATE INDEX idx_runners_runner_id ON runners(runner_id);
CREATE INDEX idx_runners_status ON runners(status);

-- Job executions
CREATE TABLE IF NOT EXISTS runner_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            VARCHAR(100) UNIQUE NOT NULL,
  runner_id         UUID NOT NULL REFERENCES runners(id) ON DELETE CASCADE,
  task_type         VARCHAR(50) NOT NULL,
  task_parameters   JSONB,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  result            JSONB,
  stdout            TEXT,
  stderr            TEXT,
  exit_code         INTEGER,
  duration_ms       INTEGER,
  error_message     TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_runner_jobs_runner ON runner_jobs(runner_id);
CREATE INDEX idx_runner_jobs_job_id ON runner_jobs(job_id);
CREATE INDEX idx_runner_jobs_status ON runner_jobs(status);

-- Runner heartbeats log
CREATE TABLE IF NOT EXISTS runner_heartbeats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runner_id       UUID NOT NULL REFERENCES runners(id) ON DELETE CASCADE,
  active_jobs     INTEGER NOT NULL DEFAULT 0,
  cpu_usage       REAL,
  memory_usage    REAL,
  disk_usage      REAL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_runner_heartbeats_runner ON runner_heartbeats(runner_id);
CREATE INDEX idx_runner_heartbeats_created ON runner_heartbeats(created_at);

-- Rollback:
-- DROP TABLE IF EXISTS runner_heartbeats, runner_jobs, runners;