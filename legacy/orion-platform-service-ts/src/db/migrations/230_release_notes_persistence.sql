-- Migration 230: Release Notes Persistence Enhancement
-- Add missing columns to release_notes table for full ReleaseNotes interface support

ALTER TABLE release_notes ADD COLUMN IF NOT EXISTS environment VARCHAR(100);
ALTER TABLE release_notes ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE release_notes ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE release_notes ADD COLUMN IF NOT EXISTS changes JSONB NOT NULL DEFAULT '[]';
ALTER TABLE release_notes ADD COLUMN IF NOT EXISTS metrics JSONB;
ALTER TABLE release_notes ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_release_notes_tenant ON release_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_release_notes_environment ON release_notes(environment);

-- Rollback:
-- ALTER TABLE release_notes DROP COLUMN IF EXISTS environment;
-- ALTER TABLE release_notes DROP COLUMN IF EXISTS generated_at;
-- ALTER TABLE release_notes DROP COLUMN IF EXISTS summary;
-- ALTER TABLE release_notes DROP COLUMN IF EXISTS changes;
-- ALTER TABLE release_notes DROP COLUMN IF EXISTS metrics;
-- ALTER TABLE release_notes DROP COLUMN IF EXISTS notes;
