-- Rollback Migration 060_create_namespace_allocations
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: namespace_allocations
DROP TABLE IF EXISTS namespace_allocations CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_name;
DROP INDEX IF EXISTS CREATE INDEX idx_name;
