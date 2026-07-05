-- Rollback Webhook Platform Enhancement

DROP INDEX IF EXISTS idx_webhook_deliveries_event;
DROP INDEX IF EXISTS idx_webhook_deliveries_subscription;
DROP INDEX IF EXISTS idx_webhook_deliveries_status;
DROP INDEX IF EXISTS idx_webhook_subscriptions_endpoint;
DROP INDEX IF EXISTS idx_webhook_subscriptions_event;
DROP INDEX IF EXISTS idx_webhook_endpoints_status;

DROP TABLE IF EXISTS webhook_deliveries;
DROP TABLE IF EXISTS webhook_subscriptions;
DROP TABLE IF EXISTS webhook_endpoints;