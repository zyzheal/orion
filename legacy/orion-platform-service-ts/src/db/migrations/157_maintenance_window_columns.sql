-- Migration 157: Add timezone and description to maintenance_windows

ALTER TABLE maintenance_windows
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_active
  ON maintenance_windows(start_time, end_time)
  WHERE end_time >= NOW();

-- Rollback:
-- ALTER TABLE maintenance_windows DROP COLUMN IF EXISTS timezone;
-- ALTER TABLE maintenance_windows DROP COLUMN IF EXISTS description;
-- ALTER TABLE maintenance_windows DROP COLUMN IF EXISTS updated_at;
-- DROP INDEX IF EXISTS idx_maintenance_windows_active;
