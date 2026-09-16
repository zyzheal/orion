-- Reverse 607_create_alert_adapter_v2_missing_tables.sql.
-- Order: child tables first (alert_notification_events references adapters).
DROP TABLE IF EXISTS alert_notification_events;
DROP TABLE IF EXISTS alert_notification_templates;
DROP TABLE IF EXISTS alert_notification_adapters;
