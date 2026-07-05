-- Rollback Migration 153_create_gitops_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: gitops_configs
DROP TABLE IF EXISTS gitops_configs CASCADE;

-- Dropping table: gitops_sync_history
DROP TABLE IF EXISTS gitops_sync_history CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_gitop;
DROP INDEX IF EXISTS CREATE INDEX idx_gitop;
DROP INDEX IF EXISTS CREATE INDEX idx_gitop;
DROP INDEX IF EXISTS CREATE INDEX idx_gitop;
