-- orion-selfhealing-svc Database Migration
-- Initial schema for self-healing service
-- Table names: selfhealing_* (no underscore, matches repository queries)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Self-Healing Incidents Table
CREATE TABLE IF NOT EXISTS selfhealing_incidents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL,
  title             VARCHAR(500) NOT NULL,
  description       TEXT,
  severity          VARCHAR(20) NOT NULL DEFAULT 'medium',
  status            VARCHAR(30) NOT NULL DEFAULT 'new',
  alert_id          VARCHAR(200),
  source            VARCHAR(100),
  trigger_source    VARCHAR(100),
  affected_resources JSONB DEFAULT '[]',
  root_cause        TEXT,
  strategy_id       VARCHAR(200),
  decision_id       UUID,
  action_ids        JSONB DEFAULT '[]',
  triggered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Self-Healing Decisions Table
CREATE TABLE IF NOT EXISTS selfhealing_decisions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id       UUID NOT NULL,
  action            VARCHAR(50) NOT NULL,
  reasoning         TEXT,
  recommended_strategy_id VARCHAR(200),
  recommended_action_id   VARCHAR(200),
  confidence        DECIMAL(5,4),
  auto_execute      BOOLEAN DEFAULT FALSE,
  decided_by        VARCHAR(100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (incident_id) REFERENCES selfhealing_incidents(id) ON DELETE CASCADE
);

-- Self-Healing Actions Table
CREATE TABLE IF NOT EXISTS selfhealing_actions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id       UUID NOT NULL,
  decision_id       UUID,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  type              VARCHAR(50) NOT NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'pending',
  action_type       VARCHAR(50),
  target_id         VARCHAR(200),
  executor          VARCHAR(100) DEFAULT 'system',
  parameters        JSONB DEFAULT '{}',
  output            JSONB,
  error             TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  FOREIGN KEY (incident_id) REFERENCES selfhealing_incidents(id) ON DELETE CASCADE,
  FOREIGN KEY (decision_id) REFERENCES selfhealing_decisions(id) ON DELETE SET NULL
);

-- Knowledge Base Table
CREATE TABLE IF NOT EXISTS selfhealing_knowledge (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL,
  title             VARCHAR(500) NOT NULL,
  description       TEXT,
  problem_pattern   TEXT NOT NULL,
  solution          TEXT NOT NULL,
  related_strategy_types JSONB DEFAULT '[]',
  tags              JSONB DEFAULT '[]',
  usage_count       INTEGER DEFAULT 0,
  success_rate      DECIMAL(5,4) DEFAULT 0,
  last_used_at      TIMESTAMPTZ,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Self-Healing Policies Table
CREATE TABLE IF NOT EXISTS selfhealing_policies (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  condition_type    VARCHAR(100) NOT NULL,
  condition_config  JSONB NOT NULL DEFAULT '{}',
  action_type       VARCHAR(100) NOT NULL,
  action_config     JSONB NOT NULL DEFAULT '{}',
  cooldown_seconds  INTEGER DEFAULT 300,
  enabled           BOOLEAN DEFAULT true,
  priority          INTEGER DEFAULT 10,
  confidence        DECIMAL(5,4) DEFAULT 0.5,
  max_retries       INTEGER DEFAULT 3,
  timeout_seconds   INTEGER DEFAULT 300,
  tenant_id         UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Self-Healing Executions Table
CREATE TABLE IF NOT EXISTS selfhealing_executions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id         UUID NOT NULL,
  incident_id       UUID,
  target            VARCHAR(255) NOT NULL,
  status            VARCHAR(50) NOT NULL DEFAULT 'pending',
  result            JSONB,
  error_message     TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  FOREIGN KEY (policy_id) REFERENCES selfhealing_policies(id) ON DELETE CASCADE,
  FOREIGN KEY (incident_id) REFERENCES selfhealing_incidents(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_incidents_tenant ON selfhealing_incidents(tenant_id);
CREATE INDEX idx_incidents_status ON selfhealing_incidents(status);
CREATE INDEX idx_incidents_severity ON selfhealing_incidents(severity);
CREATE INDEX idx_incidents_created ON selfhealing_incidents(created_at);

CREATE INDEX idx_decisions_incident ON selfhealing_decisions(incident_id);
CREATE INDEX idx_actions_incident ON selfhealing_actions(incident_id);
CREATE INDEX idx_actions_status ON selfhealing_actions(status);

CREATE INDEX idx_knowledge_tenant ON selfhealing_knowledge(tenant_id);
CREATE INDEX idx_knowledge_tags ON selfhealing_knowledge USING GIN(tags);

CREATE INDEX idx_policies_enabled ON selfhealing_policies(enabled);
CREATE INDEX idx_policies_condition_type ON selfhealing_policies(condition_type);
CREATE INDEX idx_policies_tenant ON selfhealing_policies(tenant_id);
CREATE INDEX idx_policies_priority ON selfhealing_policies(priority);

CREATE INDEX idx_executions_policy ON selfhealing_executions(policy_id);
CREATE INDEX idx_executions_incident ON selfhealing_executions(incident_id);
CREATE INDEX idx_executions_status ON selfhealing_executions(status);
CREATE INDEX idx_executions_target ON selfhealing_executions(target);

-- Rollback:
-- DROP TABLE IF EXISTS selfhealing_executions, selfhealing_policies, selfhealing_knowledge, selfhealing_actions, selfhealing_decisions, selfhealing_incidents;
