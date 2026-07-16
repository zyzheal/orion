-- Migration 287: Escalation Policies Persistence
-- Migrates escalation policies from in-memory Map to PostgreSQL

CREATE TABLE IF NOT EXISTS escalation_policies (
  id VARCHAR(100) PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('alert', 'ticket', 'incident')),
  severity VARCHAR(20),
  level INTEGER NOT NULL DEFAULT 1,
  timeout_minutes INTEGER NOT NULL,
  notify_users JSONB NOT NULL DEFAULT '[]',
  notify_channels JSONB NOT NULL DEFAULT '[]',
  auto_action VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(entity_type, severity, level)
);

CREATE INDEX IF NOT EXISTS idx_escalation_policies_entity ON escalation_policies(entity_type, severity, level);
CREATE INDEX IF NOT EXISTS idx_escalation_policies_active ON escalation_policies(is_active);
