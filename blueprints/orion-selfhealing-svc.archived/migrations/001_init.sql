-- Migration 001: Self-Healing Service Core Tables
-- Creates all core tables for healing incidents, strategies, actions, decisions, and knowledge base
-- Note: This is a dedicated self-healing microservice. monitor-svc has a separate self_healing_policies table.
-- Version: 1.0.0

-- ==================== Healing Strategies ====================
CREATE TABLE IF NOT EXISTS healing_strategies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  type              VARCHAR(50) NOT NULL,
  trigger_condition JSONB NOT NULL DEFAULT '{}',
  parameters        JSONB NOT NULL DEFAULT '{}',
  priority          INTEGER NOT NULL DEFAULT 0,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  max_retries       INTEGER NOT NULL DEFAULT 3,
  timeout_seconds   INTEGER NOT NULL DEFAULT 300,
  scope             JSONB NOT NULL DEFAULT '{}',
  severities        JSONB DEFAULT '[]',
  action_type       VARCHAR(50),
  auto_execute      BOOLEAN NOT NULL DEFAULT false,
  confidence        DECIMAL(5, 4),
  maturity          VARCHAR(50),
  metrics           JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_healing_strategies_tenant ON healing_strategies(tenant_id);
CREATE INDEX idx_healing_strategies_type ON healing_strategies(type);
CREATE INDEX idx_healing_strategies_enabled ON healing_strategies(enabled);
CREATE INDEX idx_healing_strategies_priority ON healing_strategies(priority);

-- ==================== Healing Incidents ====================
CREATE TABLE IF NOT EXISTS healing_incidents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  title             VARCHAR(500) NOT NULL,
  description       TEXT NOT NULL,
  severity          VARCHAR(20) NOT NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'new',
  alert_id          VARCHAR(255),
  source            VARCHAR(100),
  affected_resources JSONB NOT NULL DEFAULT '[]',
  root_cause        TEXT,
  strategy_id       UUID REFERENCES healing_strategies(id),
  decision_id       UUID,
  action_ids        JSONB NOT NULL DEFAULT '[]',
  trigger_source    VARCHAR(255) NOT NULL,
  triggered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_healing_incidents_tenant ON healing_incidents(tenant_id);
CREATE INDEX idx_healing_incidents_severity ON healing_incidents(severity);
CREATE INDEX idx_healing_incidents_status ON healing_incidents(status);
CREATE INDEX idx_healing_incidents_triggered ON healing_incidents(triggered_at);
CREATE INDEX idx_healing_incidents_strategy ON healing_incidents(strategy_id);

-- ==================== Healing Actions ====================
CREATE TABLE IF NOT EXISTS healing_actions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id       UUID NOT NULL REFERENCES healing_incidents(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  type              VARCHAR(50) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  parameters        JSONB NOT NULL DEFAULT '{}',
  target_id         VARCHAR(255),
  output            JSONB,
  error             TEXT,
  action_type       VARCHAR(50),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  decision_id       UUID,
  executor          VARCHAR(255) NOT NULL
);

CREATE INDEX idx_healing_actions_incident ON healing_actions(incident_id);
CREATE INDEX idx_healing_actions_status ON healing_actions(status);
CREATE INDEX idx_healing_actions_type ON healing_actions(type);
CREATE INDEX idx_healing_actions_started ON healing_actions(started_at);

-- ==================== Healing Decisions ====================
CREATE TABLE IF NOT EXISTS healing_decisions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id         UUID NOT NULL REFERENCES healing_incidents(id) ON DELETE CASCADE,
  action              VARCHAR(50) NOT NULL,
  reasoning           TEXT NOT NULL,
  recommended_strategy_id UUID REFERENCES healing_strategies(id),
  recommended_action_id   UUID REFERENCES healing_actions(id),
  confidence          DECIMAL(5, 4) NOT NULL,
  auto_execute        BOOLEAN NOT NULL DEFAULT false,
  decided_by          VARCHAR(255),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_healing_decisions_incident ON healing_decisions(incident_id);
CREATE INDEX idx_healing_decisions_action ON healing_decisions(action);
CREATE INDEX idx_healing_decisions_confidence ON healing_decisions(confidence);

-- ==================== Knowledge Base ====================
CREATE TABLE IF NOT EXISTS healing_knowledge_base (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  title                 VARCHAR(500) NOT NULL,
  description           TEXT NOT NULL,
  problem_pattern       TEXT NOT NULL,
  solution              TEXT NOT NULL,
  related_strategy_types JSONB NOT NULL DEFAULT '[]',
  tags                  JSONB NOT NULL DEFAULT '[]',
  usage_count           INTEGER NOT NULL DEFAULT 0,
  success_rate          DECIMAL(5, 4) NOT NULL DEFAULT 0,
  last_used_at          TIMESTAMPTZ,
  created_by            VARCHAR(255) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_healing_knowledge_tenant ON healing_knowledge_base(tenant_id);
CREATE INDEX idx_healing_knowledge_pattern ON healing_knowledge_base(problem_pattern);
CREATE INDEX idx_healing_knowledge_tags ON healing_knowledge_base USING GIN(tags);

-- ==================== Migration Info ====================
CREATE TABLE IF NOT EXISTS selfhealing_schema_migrations (
  version             VARCHAR(20) PRIMARY KEY,
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  description         TEXT
);

INSERT INTO selfhealing_schema_migrations (version, description)
VALUES ('001', 'Initial self-healing service tables: strategies, incidents, actions, decisions, knowledge_base');
