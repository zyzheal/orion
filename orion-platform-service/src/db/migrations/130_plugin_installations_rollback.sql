-- Rollback Migration 130_plugin_installations
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: plugin_installations
DROP TABLE IF EXISTS plugin_installations CASCADE;

-- Dropping table: plugin_versions
DROP TABLE IF EXISTS plugin_versions CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_in;
DROP INDEX IF EXISTS CREATE INDEX idx_in;
DROP INDEX IF EXISTS CREATE INDEX idx_in;
DROP INDEX IF EXISTS CREATE INDEX idx_ver;
DROP INDEX IF EXISTS CREATE INDEX idx_ver;
