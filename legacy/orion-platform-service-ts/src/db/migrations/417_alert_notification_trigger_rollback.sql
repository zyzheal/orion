-- Rollback Migration 417: Drop alert notification trigger support tables
DROP TABLE IF EXISTS alert_notification_batches CASCADE;
DROP TABLE IF EXISTS alert_escalation_history CASCADE;
DROP TABLE IF EXISTS alert_notification_dedup CASCADE;
DROP TABLE IF EXISTS alert_notification_templates CASCADE;
