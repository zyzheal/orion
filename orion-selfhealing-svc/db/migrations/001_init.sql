-- orion-selfhealing-svc Database Migration
-- Initial schema for self-healing service

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Self-Healing Incidents Table
CREATE TABLE IF NOT EXISTS self_healing_incidents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         VARCHAR(100),
  title             VARCHAR(500) NOT NULL,
  description       TEXT,
  severity          VARCHAR(20) NOT NULL DEFAULT 'medium',
  status            VARCHAR(30) NOT NULL DEFAULT 'new',
  alert_id          VARCHAR(200),
  source            VARCHAR(100),
  trigger_source    VARCHAR(100),
  affected_resources JSONB DEFAULT '[]',
  action_ids        JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Self-Healing Decisions Table
CREATE TABLE IF NOT EXISTS self_healing_decisions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id       UUID NOT NULL,
  action            VARCHAR(50) NOT NULL,
  reasoning         TEXT,
  recommended_strategy_id VARCHAR(200),
  confidence        DECIMAL(5,4),
  auto_execute      BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (incident_id) REFERENCES self_healing_incidents(id) ON DELETE CASCADE
);

-- Self-Healing Actions Table
CREATE TABLE IF NOT EXISTS self_healing_actions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id       UUID NOT NULL,
  decision_id       UUID,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  action_type       VARCHAR(50) NOT NULL,
  target_id         VARCHAR(200),
  executor          VARCHAR(100) DEFAULT 'system',
  parameters        JSONB DEFAULT '{}',
  status            VARCHAR(30) NOT NULL DEFAULT 'pending',
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  output            JSONB,
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (incident_id) REFERENCES self_healing_incidents(id) ON DELETE CASCADE,
  FOREIGN KEY (decision_id) REFERENCES self_healing_decisions(id) ON DELETE SET NULL
);

-- Knowledge Base Table
CREATE TABLE IF NOT EXISTS self_healing_knowledge (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         VARCHAR(100),
  title             VARCHAR(500) NOT NULL,
  problem_pattern   TEXT,
  solution          TEXT,
  tags              JSONB DEFAULT '[]',
  severity          VARCHAR(20),
  action_type       VARCHAR(50),
  success_rate      DECIMAL(5,4),
  usage_count       INT DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Self-Healing Audit Log Table
CREATE TABLE IF NOT EXISTS self_healing_audit (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id       UUID,
  action_id         UUID,
  action_type       VARCHAR(50) NOT NULL,
  actor             VARCHAR(100),
  details           JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_incidents_tenant ON self_healing_incidents(tenant_id);
CREATE INDEX idx_incidents_status ON self_healing_incidents(status);
CREATE INDEX idx_incidents_severity ON self_healing_incidents(severity);
CREATE INDEX idx_incidents_created ON self_healing_incidents(created_at);

CREATE INDEX idx_decisions_incident ON self_healing_decisions(incident_id);
CREATE INDEX idx_actions_incident ON self_healing_actions(incident_id);
CREATE INDEX idx_actions_status ON self_healing_actions(status);

CREATE INDEX idx_knowledge_tenant ON self_healing_knowledge(tenant_id);
CREATE INDEX idx_knowledge_tags ON self_healing_knowledge USING GIN(tags);

CREATE INDEX idx_audit_incident ON self_healing_audit(incident_id);
CREATE INDEX idx_audit_created ON self_healing_audit(created_at);

-- Rollback:
-- DROP TABLE IF EXISTS self_healing_audit, self_healing_knowledge, self_healing_actions, self_healing_decisions, self_healing_incidents;