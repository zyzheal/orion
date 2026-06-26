-- Migration 307: Incident Management Enhancements (ITIL-aligned)
-- Adds priority matrix (impact x urgency), structured timeline, post-mortem/RCA support

-- Add missing columns to incidents table
DO $$ BEGIN
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS impact VARCHAR(20) DEFAULT 'medium';
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'medium';
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assigned_team VARCHAR(255);
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS commander_id VARCHAR(255);
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS detected_by VARCHAR(100);
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS affected_services JSONB DEFAULT '[]';
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS related_problem_id UUID;
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS postmortem_url TEXT;
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS postmortem_summary TEXT;
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS tags TEXT[];
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS title VARCHAR(500);
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS description TEXT;
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(255);
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
  ALTER TABLE incidents ADD COLUMN IF NOT EXISTS closed_by VARCHAR(255);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Incident timeline (structured event log)
CREATE TABLE IF NOT EXISTS incident_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  actor_id VARCHAR(255),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident ON incident_timeline(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_timeline_tenant ON incident_timeline(tenant_id);

-- Post-mortem / RCA records
CREATE TABLE IF NOT EXISTS incident_postmortems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  summary TEXT NOT NULL,
  root_cause TEXT NOT NULL,
  contributing_factors JSONB DEFAULT '[]',
  impact_description TEXT,
  timeline JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  lessons_learned TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by VARCHAR(255),
  reviewed_by VARCHAR(255),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_postmortems_incident ON incident_postmortems(incident_id);
CREATE INDEX IF NOT EXISTS idx_postmortems_tenant ON incident_postmortems(tenant_id);
