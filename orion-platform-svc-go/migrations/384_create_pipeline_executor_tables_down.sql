-- Reverse 384_create_pipeline_executor_tables.sql.
-- Drops 3 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS pipeline_executions CASCADE;
DROP TABLE IF EXISTS pipeline_steps CASCADE;
DROP TABLE IF EXISTS pipelines CASCADE;
