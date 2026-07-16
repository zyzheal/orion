-- Rollback Migration 042_create_namespace_pools
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: namespace_pools
DROP TABLE IF EXISTS namespace_pools CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_name;
DROP INDEX IF EXISTS CREATE INDEX idx_name;
