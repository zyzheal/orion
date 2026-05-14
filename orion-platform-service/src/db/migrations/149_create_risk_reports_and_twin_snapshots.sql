-- Migration 149: Risk Reports and Digital Twin Snapshots
--
-- Support for:
-- - risk_reports: Risk assessment reports (completes RiskAssessmentService migration)
-- - digital_twin_snapshots: Digital twin configuration snapshots

-- ==================== Risk Reports ====================

CREATE TABLE IF NOT EXISTS risk_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           VARCHAR(100) NOT NULL,
  assessment_id       VARCHAR(100) NOT NULL,                    -- Links to risk_assessments
  risk_score          NUMERIC(5,2) NOT NULL,
  risk_level          VARCHAR(20) NOT NULL,                     -- Low, Medium, High, Critical
  can_deploy          BOOLEAN NOT NULL DEFAULT true,
  critical_risk_count INTEGER NOT NULL DEFAULT 0,
  summary             JSONB NOT NULL DEFAULT '{}',              -- Report summary
  details             JSONB NOT NULL DEFAULT '{}',              -- Detailed analysis
  recommendations     JSONB NOT NULL DEFAULT '[]',              -- Recommendation list
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_reports_tenant ON risk_reports(tenant_id);
CREATE INDEX idx_risk_reports_assessment ON risk_reports(assessment_id);
CREATE INDEX idx_risk_reports_level ON risk_reports(risk_level);
CREATE INDEX idx_risk_reports_created ON risk_reports(created_at DESC);

-- ==================== Digital Twin Snapshots ====================

CREATE TABLE IF NOT EXISTS digital_twin_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           VARCHAR(100) NOT NULL,
  name                VARCHAR(200) NOT NULL,
  description         TEXT,
  config              JSONB NOT NULL DEFAULT '{}',              -- Snapshot configuration
  metadata            JSONB NOT NULL DEFAULT '{}',              -- Additional metadata
  status              VARCHAR(20) NOT NULL DEFAULT 'active',    -- active, archived, deleted
  created_by          VARCHAR(100),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_digital_twin_snapshots_tenant ON digital_twin_snapshots(tenant_id);
CREATE INDEX idx_digital_twin_snapshots_status ON digital_twin_snapshots(status);
CREATE INDEX idx_digital_twin_snapshots_created ON digital_twin_snapshots(created_at DESC);