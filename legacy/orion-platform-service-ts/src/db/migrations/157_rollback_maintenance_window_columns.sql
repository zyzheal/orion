-- Rollback Migration 157: Remove timezone and description from maintenance_windows

ALTER TABLE maintenance_windows DROP COLUMN IF EXISTS timezone;
ALTER TABLE maintenance_windows DROP COLUMN IF EXISTS description;
ALTER TABLE maintenance_windows DROP COLUMN IF EXISTS updated_at;
DROP INDEX IF EXISTS idx_maintenance_windows_active;
