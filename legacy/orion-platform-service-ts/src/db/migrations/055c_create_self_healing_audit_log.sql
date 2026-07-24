-- Migration 055c: Self-Healing Audit Log
-- Persistent audit trail for all self-healing actions
-- I1 Fix: Replace in-memory audit log with PostgreSQL persistence

CREATE TABLE IF NOT EXISTS self_healing_audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id       VARCHAR(36) NOT NULL,
  action_type       VARCHAR(100) NOT NULL,
  target            VARCHAR(500) NOT NULL,
  environment       VARCHAR(100) NOT NULL,
  risk_level        VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  approvers         JSONB DEFAULT '[]',
  executor          VARCHAR(200) NOT NULL DEFAULT 'system',
  status            VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'blocked')),
  reason            TEXT,
  result            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_healing_audit_incident ON self_healing_audit_log(incident_id);
CREATE INDEX idx_healing_audit_status ON self_healing_audit_log(status);
CREATE INDEX idx_healing_audit_environment ON self_healing_audit_log(environment);
CREATE INDEX idx_healing_audit_created ON self_healing_audit_log(created_at DESC);

COMMENT ON TABLE self_healing_audit_log IS 'Audit trail for self-healing actions (replaces in-memory audit log)';
