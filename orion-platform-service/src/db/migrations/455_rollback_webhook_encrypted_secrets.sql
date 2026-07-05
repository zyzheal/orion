-- Rollback: 455_webhook_encrypted_secrets.sql
-- Removes encrypted secret columns added for webhook encryption at rest.

DROP INDEX IF EXISTS idx_webhook_endpoints_status_encrypted;
DROP INDEX IF EXISTS idx_webhooks_tenant_encrypted;

ALTER TABLE webhook_endpoints DROP COLUMN IF EXISTS auth_config_encrypted;
ALTER TABLE webhook_endpoints DROP COLUMN IF EXISTS secret_encrypted;
ALTER TABLE webhooks DROP COLUMN IF EXISTS secret_encrypted;
