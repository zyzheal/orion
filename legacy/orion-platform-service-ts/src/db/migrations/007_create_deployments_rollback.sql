-- Rollback Migration 007_create_deployments
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: deployments
DROP TABLE IF EXISTS deployments CASCADE;

-- Dropping table: deployment_events
DROP TABLE IF EXISTS deployment_events CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_deployment;
DROP INDEX IF EXISTS CREATE INDEX idx_deployment;
DROP INDEX IF EXISTS CREATE INDEX idx_deployment;
DROP INDEX IF EXISTS CREATE INDEX idx_deployment;
DROP INDEX IF EXISTS CREATE INDEX idx_deployment_event;
