-- ============================================================================
-- Rollback: Task 4.25 Config Webhook Notification Routes
-- ============================================================================

DROP TRIGGER IF EXISTS trg_config_webhooks_updated_at ON config_webhooks;
DROP FUNCTION IF EXISTS fn_set_config_webhooks_updated_at();

DROP TABLE IF EXISTS config_webhook_deliveries CASCADE;
DROP TABLE IF EXISTS config_webhooks CASCADE;
