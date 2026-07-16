-- Rollback Migration 025_create_ephemeral_env_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: ephemeral_environments
DROP TABLE IF EXISTS ephemeral_environments CASCADE;

-- Dropping table: environment_templates
DROP TABLE IF EXISTS environment_templates CASCADE;

-- Dropping table: data_seed_configs
DROP TABLE IF EXISTS data_seed_configs CASCADE;

-- Dropping table: dependency_mocks
DROP TABLE IF EXISTS dependency_mocks CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_eph_env_pr ON ephemeral_environment;
DROP INDEX IF EXISTS CREATE INDEX idx_eph_env_;
DROP INDEX IF EXISTS CREATE INDEX idx_eph_env_name;
DROP INDEX IF EXISTS CREATE INDEX idx_eph_env_created_at ON ephemeral_environment;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_mock_env ON dependency_mock;
