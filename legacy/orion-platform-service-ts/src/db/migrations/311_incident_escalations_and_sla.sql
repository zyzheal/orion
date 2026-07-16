-- Migration 311: Incident Escalations, SLA tracking, and Postmortem enhancements
-- Builds on migration 307 (incident_timeline, incident_postmortems)

-- Add missing columns to incidents table for escalation and SLA
DO $$ BEGIN
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS escalation_level INT DEFAULT 0;
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS sla_breach BOOLEAN DEFAULT FALSE;
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS sla_breach_at TIMESTAMPTZ;
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS postmortem_required BOOLEAN DEFAULT FALSE;
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS linked_problem_id UUID;
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS linked_change_id UUID;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Incident escalations table
CREATE TABLE IF NOT EXISTS incident_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  from_level INT NOT NULL DEFAULT 0,
  to_level INT NOT NULL,
  reason TEXT,
  escalated_by VARCHAR(255) NOT NULL,
  escalated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_escalations_incident ON incident_escalations(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_escalations_tenant ON incident_escalations(tenant_id);

-- Add UNIQUE constraint on incident_id for postmortems (one postmortem per incident)
DO $$ BEGIN
  ALTER TABLE incident_postmortems ADD CONSTRAINT uq_postmortems_incident UNIQUE (incident_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add title and timeline_summary columns to postmortems if missing
DO $$ BEGIN
  ALTER TABLE incident_postmortems ADD COLUMN IF NOT EXISTS title VARCHAR(500);
  ALTER TABLE incident_postmortems ADD COLUMN IF NOT EXISTS timeline_summary TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- SLA breach detection function
CREATE OR REPLACE FUNCTION check_incident_sla_breach()
RETURNS TRIGGER AS $$
DECLARE
  sla_minutes INT;
BEGIN
  -- SLA thresholds by severity (minutes)
  CASE NEW.severity
    WHEN 'critical' THEN sla_minutes := 15;
    WHEN 'high'     THEN sla_minutes := 60;
    WHEN 'medium'   THEN sla_minutes := 240;
    WHEN 'low'      THEN sla_minutes := 1440;
    ELSE sla_minutes := 240;
  END CASE;

  -- Mark breach if unresolved and past SLA
  IF NEW.status NOT IN ('resolved', 'closed') AND NEW.sla_breach = FALSE THEN
    IF EXTRACT(EPOCH FROM (NOW() - NEW.detected_at)) / 60 > sla_minutes THEN
      NEW.sla_breach := TRUE;
      NEW.sla_breach_at := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger SLA check on update
DROP TRIGGER IF EXISTS incidents_sla_check ON incidents;
CREATE TRIGGER incidents_sla_check
  BEFORE UPDATE ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION check_incident_sla_breach();

-- Comments
COMMENT ON TABLE incident_escalations IS 'Incident escalation history tracking';
COMMENT ON COLUMN incidents.escalation_level IS 'Current escalation level (0 = not escalated)';
COMMENT ON COLUMN incidents.sla_breach IS 'Whether the incident has breached its SLA';
COMMENT ON COLUMN incidents.postmortem_required IS 'Whether a postmortem is required for this incident';

-- Rollback:
-- DROP TRIGGER IF EXISTS incidents_sla_check ON incidents;
-- DROP FUNCTION IF EXISTS check_incident_sla_breach();
-- DROP TABLE IF EXISTS incident_escalations;
-- ALTER TABLE incidents DROP COLUMN IF EXISTS escalation_level;
-- ALTER TABLE incidents DROP COLUMN IF EXISTS sla_breach;
-- ALTER TABLE incidents DROP COLUMN IF EXISTS sla_breach_at;
-- ALTER TABLE incidents DROP COLUMN IF EXISTS postmortem_required;
-- ALTER TABLE incidents DROP COLUMN IF EXISTS linked_problem_id;
-- ALTER TABLE incidents DROP COLUMN IF EXISTS linked_change_id;
