-- Rollback Migration 027_create_policy_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: policy_definitions
DROP TABLE IF EXISTS policy_definitions CASCADE;

-- Dropping table: policy_bundles
DROP TABLE IF EXISTS policy_bundles CASCADE;

-- Dropping table: policy_evaluations
DROP TABLE IF EXISTS policy_evaluations CASCADE;

-- Dropping table: policy_violations
DROP TABLE IF EXISTS policy_violations CASCADE;

-- Dropping table: policy_overrides
DROP TABLE IF EXISTS policy_overrides CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_policy_definition;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_bundle;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_evaluation;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_evaluation;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_violation;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_violation;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_override;
