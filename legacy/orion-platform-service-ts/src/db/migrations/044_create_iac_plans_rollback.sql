-- Rollback Migration 044_create_iac_plans
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: iac_plans
DROP TABLE IF EXISTS iac_plans CASCADE;

-- Dropping table: iac_drift_results
DROP TABLE IF EXISTS iac_drift_results CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_iac_plan;
DROP INDEX IF EXISTS CREATE INDEX idx_iac_plan;
DROP INDEX IF EXISTS CREATE INDEX idx_iac_drift_re;
DROP INDEX IF EXISTS CREATE INDEX idx_iac_drift_detected ON iac_drift_re;
