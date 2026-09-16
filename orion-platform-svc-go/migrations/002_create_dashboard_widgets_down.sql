-- Reverse 002_create_dashboard_widgets.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS metric_registrations CASCADE;
