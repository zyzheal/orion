-- Migration 067: Runbook Orchestration Engine (Migration 323)
-- Runbook 自动化：定义、步骤、执行记录、步骤结果、定时调度

-- 1. runbook_definitions 表
CREATE TABLE IF NOT EXISTS runbook_definitions (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  category        VARCHAR(64),             -- restart|cleanup|deploy|diagnostic|custom
  enabled         BOOLEAN DEFAULT true,
  timeout_seconds INTEGER DEFAULT 3600,
  retry_policy    JSONB,
  parameters      JSONB DEFAULT '[]',
  created_by      VARCHAR(64),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RLS 多租户隔离
ALTER TABLE runbook_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE runbook_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON runbook_definitions USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_runbook_def_tenant ON runbook_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_runbook_def_category ON runbook_definitions(category);
CREATE INDEX IF NOT EXISTS idx_runbook_def_enabled ON runbook_definitions(enabled);

-- 2. runbook_steps 表
CREATE TABLE IF NOT EXISTS runbook_steps (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  runbook_id      VARCHAR(64) NOT NULL REFERENCES runbook_definitions(id) ON DELETE CASCADE,
  step_order      INTEGER NOT NULL,
  step_type       VARCHAR(32) NOT NULL,    -- script|http|pipeline|wait|condition|approval
  name            VARCHAR(255) NOT NULL,
  config          JSONB NOT NULL,
  conditions      JSONB,
  on_failure      VARCHAR(32) DEFAULT 'abort',  -- abort|skip|retry
  max_retries     INTEGER DEFAULT 0,
  timeout_seconds INTEGER DEFAULT 300,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RLS 多租户隔离
ALTER TABLE runbook_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE runbook_steps FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON runbook_steps USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_runbook_step_runbook ON runbook_steps(runbook_id, step_order);
CREATE INDEX IF NOT EXISTS idx_runbook_step_tenant ON runbook_steps(tenant_id);

-- 3. runbook_executions 表
CREATE TABLE IF NOT EXISTS runbook_executions (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  runbook_id      VARCHAR(64) NOT NULL REFERENCES runbook_definitions(id),
  trigger_type    VARCHAR(32) NOT NULL,    -- manual|alert|schedule|event
  trigger_id      VARCHAR(64),
  status          VARCHAR(32) NOT NULL DEFAULT 'pending',  -- pending|running|completed|failed|timeout|cancelled
  input_args      JSONB,
  output          JSONB,
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  duration_ms     INTEGER,
  executed_by     VARCHAR(64),
  error_message   TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RLS 多租户隔离
ALTER TABLE runbook_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE runbook_executions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON runbook_executions USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_runbook_exec_runbook ON runbook_executions(runbook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runbook_exec_status ON runbook_executions(status);
CREATE INDEX IF NOT EXISTS idx_runbook_exec_tenant ON runbook_executions(tenant_id);

-- 4. runbook_step_results 表
CREATE TABLE IF NOT EXISTS runbook_step_results (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  execution_id    VARCHAR(64) NOT NULL REFERENCES runbook_executions(id) ON DELETE CASCADE,
  step_id         VARCHAR(64) NOT NULL REFERENCES runbook_steps(id),
  step_order      INTEGER NOT NULL,
  status          VARCHAR(32) NOT NULL DEFAULT 'pending',  -- pending|running|completed|failed|skipped
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  output          TEXT,
  error_message   TEXT,
  retry_count     INTEGER DEFAULT 0,
  agent_id        VARCHAR(64),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RLS 多租户隔离
ALTER TABLE runbook_step_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE runbook_step_results FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON runbook_step_results USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_step_result_execution ON runbook_step_results(execution_id, step_order);
CREATE INDEX IF NOT EXISTS idx_step_result_tenant ON runbook_step_results(tenant_id);

-- 5. runbook_schedules 表
CREATE TABLE IF NOT EXISTS runbook_schedules (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  runbook_id      VARCHAR(64) NOT NULL REFERENCES runbook_definitions(id) ON DELETE CASCADE,
  cron_expression VARCHAR(64) NOT NULL,
  timezone        VARCHAR(64) DEFAULT 'Asia/Shanghai',
  input_args      JSONB,
  enabled         BOOLEAN DEFAULT true,
  last_run_at     TIMESTAMP,
  next_run_at     TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RLS 多租户隔离
ALTER TABLE runbook_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE runbook_schedules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON runbook_schedules USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_runbook_schedule_runbook ON runbook_schedules(runbook_id);
CREATE INDEX IF NOT EXISTS idx_runbook_schedule_tenant ON runbook_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_runbook_schedule_enabled ON runbook_schedules(enabled);
