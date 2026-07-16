-- Rollback Migration 032_create_iac_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: iac_workspaces
DROP TABLE IF EXISTS iac_workspaces CASCADE;

-- Dropping table: iac_plans
DROP TABLE IF EXISTS iac_plans CASCADE;

-- Dropping table: iac_state_versions
DROP TABLE IF EXISTS iac_state_versions CASCADE;

-- Dropping table: iac_modules
DROP TABLE IF EXISTS iac_modules CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_iac_work;
DROP INDEX IF EXISTS CREATE INDEX idx_iac_work;
DROP INDEX IF EXISTS CREATE INDEX idx_iac_work;
DROP INDEX IF EXISTS CREATE INDEX idx_iac_work;
DROP INDEX IF EXISTS CREATE INDEX idx_iac_plan;
DROP INDEX IF EXISTS CREATE INDEX idx_iac_plan;
DROP INDEX IF EXISTS CREATE INDEX idx_iac_plan;
DROP INDEX IF EXISTS CREATE INDEX idx_iac_;
DROP INDEX IF EXISTS CREATE INDEX idx_iac_;
DROP INDEX IF EXISTS CREATE INDEX idx_iac_module;
