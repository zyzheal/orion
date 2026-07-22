-- Rollback Migration 049_create_monitoring_rules_channels
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: monitoring_alert_rules
DROP TABLE IF EXISTS monitoring_alert_rules CASCADE;

-- Dropping table: monitoring_notification_channels
DROP TABLE IF EXISTS monitoring_notification_channels CASCADE;

-- Dropping table: monitoring_escalation_policies
DROP TABLE IF EXISTS monitoring_escalation_policies CASCADE;

-- Dropping table: monitoring_notification_history
DROP TABLE IF EXISTS monitoring_notification_history CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_monitoring_alert_rule;
DROP INDEX IF EXISTS CREATE INDEX idx_monitoring_alert_rule;
DROP INDEX IF EXISTS CREATE INDEX idx_monitoring_alert_rule;
DROP INDEX IF EXISTS CREATE INDEX idx_monitoring_notification_channel;
DROP INDEX IF EXISTS CREATE INDEX idx_monitoring_notification_channel;
DROP INDEX IF EXISTS CREATE INDEX idx_monitoring_e;
DROP INDEX IF EXISTS CREATE INDEX idx_monitoring_notification_hi;
DROP INDEX IF EXISTS CREATE INDEX idx_monitoring_notification_hi;
DROP INDEX IF EXISTS CREATE INDEX idx_monitoring_notification_hi;
