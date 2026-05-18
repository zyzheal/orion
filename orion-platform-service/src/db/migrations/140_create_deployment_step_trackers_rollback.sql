-- Rollback Migration 140_create_deployment_step_trackers
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: deployment_step_trackers
DROP TABLE IF EXISTS deployment_step_trackers CASCADE;

-- Dropping table: deployment_health_checks
DROP TABLE IF EXISTS deployment_health_checks CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_health_check;
DROP INDEX IF EXISTS CREATE INDEX idx_health_check;
