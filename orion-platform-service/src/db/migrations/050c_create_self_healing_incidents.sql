-- Migration 050: Self-Healing Incidents & Approvals
-- Persistent storage for healing incidents and approval workflow

-- Self-healing incidents (runtime data - replaces Map storage)
CREATE TABLE IF NOT EXISTS self_healing_incidents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id          VARCHAR(200),
  type              VARCHAR(50) NOT NULL,
  severity          VARCHAR(20) NOT NULL,
  app_name          VARCHAR(200) NOT NULL,
  environment       VARCHAR(50) NOT NULL,
  strategy_id       VARCHAR(200),
  strategy_name     VARCHAR(200),
  actions           JSONB NOT NULL DEFAULT '[]',
  status            VARCHAR(30) NOT NULL DEFAULT 'new',
  attempts          INT NOT NULL DEFAULT 0,
  approval_status   VARCHAR(20),
  approval_request_id UUID,
  result            JSONB,
  error             TEXT,
  tags              JSONB,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);
CREATE INDEX idx_healing_incidents_status ON self_healing_incidents(status);
CREATE INDEX idx_healing_incidents_app ON self_healing_incidents(app_name);
CREATE INDEX idx_healing_incidents_type ON self_healing_incidents(type);
CREATE INDEX idx_healing_incidents_severity ON self_healing_incidents(severity);
CREATE INDEX idx_healing_incidents_started ON self_healing_incidents(started_at);

-- Self-healing approval requests (runtime data - replaces Map storage)
CREATE TABLE IF NOT EXISTS self_healing_approvals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id       UUID NOT NULL REFERENCES self_healing_incidents(id) ON DELETE CASCADE,
  title             VARCHAR(500) NOT NULL,
  description       TEXT,
  risk_level        VARCHAR(20) NOT NULL,
  recommended_actions JSONB NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  requested_by      VARCHAR(200) NOT NULL DEFAULT 'system',
  approved_by       VARCHAR(200),
  approval_reason   TEXT,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ
);
CREATE INDEX idx_healing_approvals_status ON self_healing_approvals(status);
CREATE INDEX idx_healing_approvals_incident ON self_healing_approvals(incident_id);

-- Rollback:
-- DROP TABLE IF EXISTS self_healing_approvals, self_healing_incidents;
