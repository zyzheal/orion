-- Reverse 382_create_alert_pipeline_results.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS alert_pipeline_results CASCADE;
