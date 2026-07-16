-- Rollback Migration 021_create_webhooks
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: webhooks
DROP TABLE IF EXISTS webhooks CASCADE;

-- Dropping table: webhook_deliveries
DROP TABLE IF EXISTS webhook_deliveries CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_webhook;
DROP INDEX IF EXISTS CREATE INDEX idx_webhook_deliverie;
DROP INDEX IF EXISTS CREATE INDEX idx_webhook_deliverie;
