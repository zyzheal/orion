-- Migration 253: Runner CI Task Execution Tables
-- Core tables for runner agent registry, job execution tracking, and heartbeat history.
-- Translated from TS blueprint: blueprints/orion-runner-svc/migrations/001_init.sql
--
-- Tables:
--   runner_agents    — CI worker nodes registered with the platform
--   runner_jobs      — Job execution history per agent
--   runner_heartbeats — Periodic heartbeat records from agents
--
-- Rollback: 253_create_runner_tables_down.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Runner Agent Registry
CREATE TABLE IF NOT EXISTS runner_agents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          VARCHAR(100) UNIQUE NOT NULL,
  tenant_id         VARCHAR(64) NOT NULL,
  name              VARCHAR(200) NOT NULL,
  labels            JSONB NOT NULL DEFAULT '[]',
  endpoint          VARCHAR(512) NOT NULL,
  max_concurrent    INTEGER NOT NULL DEFAULT 5,
  status            VARCHAR(20) NOT NULL DEFAULT 'registering',
  metadata          JSONB NOT NULL DEFAULT '{}',
  last_heartbeat_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_runner_agents_tenant ON runner_agents(tenant_id);
CREATE INDEX idx_runner_agents_agent_id ON runner_agents(agent_id);
CREATE INDEX idx_runner_agents_status ON runner_agents(status);

-- Job Executions
CREATE TABLE IF NOT EXISTS runner_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            VARCHAR(100) UNIQUE NOT NULL,
  agent_id          UUID NOT NULL REFERENCES runner_agents(id) ON DELETE CASCADE,
  tenant_id         VARCHAR(64) NOT NULL,
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
CREATE INDEX idx_runner_jobs_tenant ON runner_jobs(tenant_id);
CREATE INDEX idx_runner_jobs_agent ON runner_jobs(agent_id);
CREATE INDEX idx_runner_jobs_job_id ON runner_jobs(job_id);
CREATE INDEX idx_runner_jobs_status ON runner_jobs(status);

-- Runner Heartbeat Log
CREATE TABLE IF NOT EXISTS runner_heartbeats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        VARCHAR(100) NOT NULL REFERENCES runner_agents(agent_id) ON DELETE CASCADE,
  active_jobs     INTEGER NOT NULL DEFAULT 0,
  cpu_usage       REAL,
  memory_usage    REAL,
  disk_usage      REAL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_runner_heartbeats_agent ON runner_heartbeats(agent_id);
CREATE INDEX idx_runner_heartbeats_created ON runner_heartbeats(created_at);
