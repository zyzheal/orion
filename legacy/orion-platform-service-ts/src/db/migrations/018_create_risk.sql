-- Migration 018: Risk Management
-- Risk assessment and scoring

CREATE TABLE IF NOT EXISTS risk_assessments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  type          VARCHAR(50) NOT NULL,
  target_type   VARCHAR(100) NOT NULL,
  target_id     UUID NOT NULL,
  score         DECIMAL(5,2),
  risk_level    VARCHAR(20),
  findings      JSONB NOT NULL DEFAULT '[]',
  status        VARCHAR(20) NOT NULL DEFAULT 'completed',
  assessed_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_risk_assessments_tenant ON risk_assessments(tenant_id);
CREATE INDEX idx_risk_assessments_level ON risk_assessments(risk_level);

-- Risk rules
CREATE TABLE IF NOT EXISTS risk_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  condition     JSONB NOT NULL,
  weight        DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rollback:
-- DROP TABLE IF EXISTS risk_rules, risk_assessments;
