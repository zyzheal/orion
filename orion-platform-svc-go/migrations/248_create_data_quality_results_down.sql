-- Reverse 248_create_data_quality_results.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS quality_results CASCADE;
