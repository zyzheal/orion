-- Rollback Migration 055_create_chatops_phase1a_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: chatops_messages
DROP TABLE IF EXISTS chatops_messages CASCADE;

-- Dropping table: chatops_notification_preferences
DROP TABLE IF EXISTS chatops_notification_preferences CASCADE;

-- Dropping table: chatops_dnd_settings
DROP TABLE IF EXISTS chatops_dnd_settings CASCADE;

-- Dropping table: chatops_alert_states
DROP TABLE IF EXISTS chatops_alert_states CASCADE;

-- Dropping table: chatops_ttl_policies
DROP TABLE IF EXISTS chatops_ttl_policies CASCADE;

-- Dropping table: chatops_idempotency_keys
DROP TABLE IF EXISTS chatops_idempotency_keys CASCADE;

-- Dropping table: chatops_platform_configs
DROP TABLE IF EXISTS chatops_platform_configs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
DROP INDEX IF EXISTS CREATE INDEX idx_chatop;
