-- Rollback Migration 105_multimodal_trigger
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: trigger_definitions
DROP TABLE IF EXISTS trigger_definitions CASCADE;

-- Dropping table: trigger_executions
DROP TABLE IF EXISTS trigger_executions CASCADE;

-- Dropping table: webhook_registrations
DROP TABLE IF EXISTS webhook_registrations CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_trigger_definition;
DROP INDEX IF EXISTS CREATE INDEX idx_trigger_definition;
DROP INDEX IF EXISTS CREATE INDEX idx_trigger_definition;
DROP INDEX IF EXISTS CREATE INDEX idx_trigger_definition;
DROP INDEX IF EXISTS CREATE INDEX idx_trigger_execution;
DROP INDEX IF EXISTS CREATE INDEX idx_trigger_execution;
DROP INDEX IF EXISTS CREATE INDEX idx_trigger_execution;
DROP INDEX IF EXISTS CREATE INDEX idx_trigger_execution;
DROP INDEX IF EXISTS CREATE INDEX idx_webhook_regi;
DROP INDEX IF EXISTS CREATE INDEX idx_webhook_regi;
DROP INDEX IF EXISTS CREATE INDEX idx_webhook_regi;
