-- Reverse 273_create_data_pipeline.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS data_pipeline_runs CASCADE;
DROP TABLE IF EXISTS data_pipelines CASCADE;
