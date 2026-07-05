-- Rollback Migration 066_create_ephemeral_environments
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: ephemeral_environments
DROP TABLE IF EXISTS ephemeral_environments CASCADE;

DROP INDEX IF EXISTS idx_ephemeral_env_pr ON ephemeral_environment;
DROP INDEX IF EXISTS idx_ephemeral_env_repo ON ephemeral_environment;
DROP INDEX IF EXISTS idx_ephemeral_env_;
DROP INDEX IF EXISTS idx_ephemeral_env_created ON ephemeral_environment;
