-- Migration 069: Create incidents table for precise MTTR calculation
-- Independent incident tracking (not just self_healing_incidents)

CREATE TABLE IF NOT EXISTS incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  deployment_id   UUID REFERENCES deployments(id) ON DELETE SET NULL,
  pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  commit_sha      VARCHAR(40),

  -- Incident classification
  type            VARCHAR(50) NOT NULL,          -- service_down, performance_degradation, error_rate_spike, etc.
  severity        VARCHAR(20) NOT NULL,          -- critical, high, medium, low
  status          VARCHAR(20) NOT NULL DEFAULT 'open',  -- open, acknowledged, resolved

  -- Time tracking for MTTR calculation
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  recovery_time_ms BIGINT,                       -- Auto-calculated: resolved_at - detected_at

  -- Context
  service         VARCHAR(200),
  environment     VARCHAR(50),
  error_message   TEXT,

  -- Metadata
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_incidents_tenant ON incidents(tenant_id);
CREATE INDEX idx_incidents_deployment ON incidents(deployment_id);
CREATE INDEX idx_incidents_pipeline ON incidents(pipeline_run_id);
CREATE INDEX idx_incidents_commit ON incidents(commit_sha);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_detected_at ON incidents(detected_at);
CREATE INDEX idx_incidents_type_severity ON incidents(type, severity);

-- Comments
COMMENT ON TABLE incidents IS 'Independent incident tracking for MTTR calculation';
COMMENT ON COLUMN incidents.recovery_time_ms IS 'Time from detection to resolution in milliseconds';

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_incidents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER incidents_updated_at_trigger
  BEFORE UPDATE ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION update_incidents_updated_at();

-- Rollback:
-- DROP TRIGGER IF EXISTS incidents_updated_at_trigger ON incidents;
-- DROP FUNCTION IF EXISTS update_incidents_updated_at();
-- DROP TABLE IF EXISTS incidents;