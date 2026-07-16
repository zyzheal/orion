-- Rollback Migration 123_create_environment_executor_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: environment_executor_states
DROP TABLE IF EXISTS environment_executor_states CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_env_executor_tenant ON environment_executor_;
DROP INDEX IF EXISTS CREATE INDEX idx_env_executor_;
