-- 106: Cross Domain
-- 编排工作流、工作流步骤、步骤执行

-- orchestration_workflows 表（编排工作流定义）
CREATE TABLE IF NOT EXISTS orchestration_workflows (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_name     VARCHAR(200) NOT NULL,
  description       TEXT,
  workflow_type     VARCHAR(50) NOT NULL,                      -- pipeline, deployment, rollback, migration, cleanup
  trigger_config    JSONB NOT NULL DEFAULT '{}',
  steps             JSONB NOT NULL DEFAULT '[]',
  timeout_seconds   INT NOT NULL DEFAULT 3600,
  retry_policy      JSONB NOT NULL DEFAULT '{"max_retries": 2}',
  status            VARCHAR(30) NOT NULL DEFAULT 'draft',      -- draft, active, paused, archived
  version           VARCHAR(20) NOT NULL DEFAULT '1.0',
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orchestration_workflows_tenant ON orchestration_workflows(tenant_id);
CREATE INDEX idx_orchestration_workflows_type ON orchestration_workflows(workflow_type);
CREATE INDEX idx_orchestration_workflows_status ON orchestration_workflows(status);
CREATE INDEX idx_orchestration_workflows_version ON orchestration_workflows(version);

-- workflow_steps 表（工作流步骤定义）
CREATE TABLE IF NOT EXISTS workflow_steps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id       UUID NOT NULL REFERENCES orchestration_workflows(id) ON DELETE CASCADE,
  step_name         VARCHAR(200) NOT NULL,
  step_type         VARCHAR(50) NOT NULL,                      -- script, api, approval, condition, parallel, wait
  step_order        INT NOT NULL,
  depends_on        JSONB NOT NULL DEFAULT '[]',
  config            JSONB NOT NULL DEFAULT '{}',
  timeout_seconds   INT DEFAULT 300,
  on_failure        VARCHAR(30) NOT NULL DEFAULT 'stop',       -- stop, continue, retry, skip
  status            VARCHAR(30) NOT NULL DEFAULT 'active',     -- active, disabled, deprecated
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workflow_steps_tenant ON workflow_steps(tenant_id);
CREATE INDEX idx_workflow_steps_workflow ON workflow_steps(workflow_id);
CREATE INDEX idx_workflow_steps_order ON workflow_steps(step_order);
CREATE INDEX idx_workflow_steps_type ON workflow_steps(step_type);

-- step_executions 表（步骤执行记录）
CREATE TABLE IF NOT EXISTS step_executions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id       UUID NOT NULL REFERENCES orchestration_workflows(id) ON DELETE CASCADE,
  step_id           UUID REFERENCES workflow_steps(id) ON DELETE SET NULL,
  execution_id      VARCHAR(100) NOT NULL,
  run_number        INT NOT NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'pending',    -- pending, running, completed, failed, skipped, cancelled
  input_data        JSONB NOT NULL DEFAULT '{}',
  output_data       JSONB NOT NULL DEFAULT '{}',
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  duration_ms       INT,
  error_message     TEXT,
  logs              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_step_executions_tenant ON step_executions(tenant_id);
CREATE INDEX idx_step_executions_workflow ON step_executions(workflow_id);
CREATE INDEX idx_step_executions_step ON step_executions(step_id);
CREATE INDEX idx_step_executions_status ON step_executions(status);
CREATE INDEX idx_step_executions_run ON step_executions(execution_id);
CREATE INDEX idx_step_executions_started ON step_executions(started_at DESC);

-- RLS
ALTER TABLE orchestration_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_orchestration_workflows ON orchestration_workflows
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_workflow_steps ON workflow_steps
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_step_executions ON step_executions
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
