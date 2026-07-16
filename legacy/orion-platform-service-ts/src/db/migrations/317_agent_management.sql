-- Migration 317: Agent Management (Migration 329 in design doc)
-- Agent 管理：心跳日志、执行统计

CREATE TABLE agent_heartbeat_log (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  agent_id        VARCHAR(64) NOT NULL,
  status          VARCHAR(32) NOT NULL,
  resource_usage  JSONB,
  running_tasks   INTEGER DEFAULT 0,
  received_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE agent_heartbeat_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_heartbeat_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON agent_heartbeat_log USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_agent_heartbeat_agent ON agent_heartbeat_log(agent_id, received_at DESC);

-- Agent execution statistics
CREATE TABLE agent_execution_stats (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  agent_id        VARCHAR(64) NOT NULL,
  date            DATE NOT NULL,
  total_executions INTEGER DEFAULT 0,
  success_count   INTEGER DEFAULT 0,
  failed_count    INTEGER DEFAULT 0,
  avg_duration_ms INTEGER,
  UNIQUE(agent_id, date)
);

ALTER TABLE agent_execution_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_execution_stats FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON agent_execution_stats USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_agent_execution_stats_agent ON agent_execution_stats(agent_id);

-- AI Agents table (persistent agent definitions)
CREATE TABLE ai_agents (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  agent_type      VARCHAR(64) NOT NULL,
  config          JSONB NOT NULL DEFAULT '{}',
  capability_tags JSONB DEFAULT '[]',
  status          VARCHAR(32) NOT NULL DEFAULT 'active',
  agent_version   VARCHAR(32),
  last_heartbeat  TIMESTAMP,
  resource_info   JSONB,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_by      VARCHAR(64),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ai_agents USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_ai_agents_tenant ON ai_agents(tenant_id);
CREATE INDEX idx_ai_agents_status ON ai_agents(status);

-- AI Agent executions
CREATE TABLE ai_agent_executions (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  agent_id        VARCHAR(64) NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  task_type       VARCHAR(64) NOT NULL,
  input           JSONB,
  output          JSONB,
  status          VARCHAR(32) NOT NULL DEFAULT 'pending',
  error           TEXT,
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  duration_ms     INTEGER,
  executed_by     VARCHAR(64),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_executions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ai_agent_executions USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_ai_agent_executions_agent ON ai_agent_executions(agent_id);
CREATE INDEX idx_ai_agent_executions_status ON ai_agent_executions(status);
