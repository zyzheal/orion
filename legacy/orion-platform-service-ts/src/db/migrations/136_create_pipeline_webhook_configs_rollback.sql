-- Rollback Migration 136_create_pipeline_webhook_configs
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: pipeline_webhook_configs
DROP TABLE IF EXISTS pipeline_webhook_configs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_webhook_config;
DROP INDEX IF EXISTS CREATE INDEX idx_webhook_config;
