-- Rollback Migration 008_create_environments
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: environments
DROP TABLE IF EXISTS environments CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_environment;
DROP INDEX IF EXISTS CREATE INDEX idx_environment;
