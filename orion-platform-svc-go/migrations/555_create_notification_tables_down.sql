-- Reverse 555_create_notification_tables.sql.
-- Drops 13 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS anomalies CASCADE;
DROP TABLE IF EXISTS dashboard_widgets CASCADE;
DROP TABLE IF EXISTS dashboards CASCADE;
DROP TABLE IF EXISTS do_not_disturb CASCADE;
DROP TABLE IF EXISTS scheduled_notification_instances CASCADE;
DROP TABLE IF EXISTS notification_workflows CASCADE;
DROP TABLE IF EXISTS notification_policies CASCADE;
DROP TABLE IF EXISTS notification_template_definitions CASCADE;
DROP TABLE IF EXISTS notification_deliveries CASCADE;
DROP TABLE IF EXISTS notification_subscriptions CASCADE;
DROP TABLE IF EXISTS notification_settings CASCADE;
DROP TABLE IF EXISTS notification_channel_configs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
