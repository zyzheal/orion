-- Rollback Migration 068_add_deployment_commit_sha
-- Auto-generated rollback script
-- Review carefully before executing in production

DROP INDEX IF EXISTS idx_deployment;
