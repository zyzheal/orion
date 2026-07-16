-- Rollback Migration 032: Drop IaC Management tables
DROP TABLE IF EXISTS iac_modules CASCADE;
DROP TABLE IF EXISTS iac_state_versions CASCADE;
DROP TABLE IF EXISTS iac_plans CASCADE;
DROP TABLE IF EXISTS iac_workspaces CASCADE;
