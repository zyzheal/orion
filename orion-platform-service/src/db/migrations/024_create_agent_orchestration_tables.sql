-- Migration 024: AI Agent Orchestration Tables
-- Creates tables for Agent profiles, runs, decisions, and approvals

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agent 定义
CREATE TABLE IF NOT EXISTS agent_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL UNIQUE,
  role            VARCHAR(50) NOT NULL,
  description     TEXT,
  tools           JSONB NOT NULL DEFAULT '[]',
  capabilities    JSONB,
  constraints     JSONB,
  llm_config      JSONB,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent 运行记录
CREATE TABLE IF NOT EXISTS agent_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_profile_id UUID NOT NULL REFERENCES agent_profiles(id),
  trigger_payload JSONB NOT NULL DEFAULT '{}',
  status          VARCHAR(20) NOT NULL DEFAULT 'running',
  current_step    INT DEFAULT 0,
  total_steps     INT NOT NULL DEFAULT 1,
  result          JSONB,
  error           TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  timeout_at      TIMESTAMPTZ NOT NULL,
  tenant_id       UUID
);
CREATE INDEX idx_agent_runs_profile ON agent_runs(agent_profile_id);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);

-- Agent 决策日志
CREATE TABLE IF NOT EXISTS agent_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  agent_id        UUID NOT NULL REFERENCES agent_profiles(id),
  step_number     INT NOT NULL,
  action          VARCHAR(50) NOT NULL,
  action_input    JSONB NOT NULL DEFAULT '{}',
  action_output   JSONB,
  reasoning       TEXT,
  tool_result     JSONB,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_decisions_run ON agent_decisions(run_id);

-- Agent 审批记录
CREATE TABLE IF NOT EXISTS agent_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES agent_runs(id),
  agent_id        UUID NOT NULL REFERENCES agent_profiles(id),
  action          VARCHAR(50) NOT NULL,
  action_input    JSONB NOT NULL DEFAULT '{}',
  reason          TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_approvals_run ON agent_approvals(run_id);
CREATE INDEX idx_agent_approvals_status ON agent_approvals(status);

-- Rollback:
-- DROP TABLE IF EXISTS agent_approvals, agent_decisions, agent_runs, agent_profiles;
