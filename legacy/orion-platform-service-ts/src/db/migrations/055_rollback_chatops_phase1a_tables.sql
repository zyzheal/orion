-- Rollback Migration 055: ChatOps Phase 1a
DROP TABLE IF EXISTS chatops_platform_configs;
DROP TABLE IF EXISTS chatops_idempotency_keys;
DROP TABLE IF EXISTS chatops_ttl_policies;
DROP TABLE IF EXISTS chatops_alert_states;
DROP TABLE IF EXISTS chatops_dnd_settings;
DROP TABLE IF EXISTS chatops_notification_preferences;
DROP TABLE IF EXISTS chatops_messages;

-- Remove added columns from chatops_sessions
ALTER TABLE chatops_sessions
  DROP COLUMN IF EXISTS context,
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at;
