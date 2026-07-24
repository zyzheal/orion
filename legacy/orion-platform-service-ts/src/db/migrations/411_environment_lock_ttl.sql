-- Migration 411: Environment lock TTL/expiration
-- Add automatic lock expiration to prevent stale locks

ALTER TABLE environments ADD COLUMN IF NOT EXISTS locked_expires_at TIMESTAMPTZ;
ALTER TABLE environments ADD COLUMN IF NOT EXISTS locked_duration_seconds INTEGER DEFAULT 3600;

-- Index for finding expired locks efficiently
CREATE INDEX IF NOT EXISTS idx_environments_locked_expires ON environments(locked_expires_at) WHERE locked = TRUE;

-- Rollback:
-- DROP INDEX IF EXISTS idx_environments_locked_expires;
-- ALTER TABLE environments DROP COLUMN IF EXISTS locked_duration_seconds;
-- ALTER TABLE environments DROP COLUMN IF EXISTS locked_expires_at;
