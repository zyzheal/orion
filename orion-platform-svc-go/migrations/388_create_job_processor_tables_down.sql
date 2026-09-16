-- Reverse 388_create_job_processor_tables.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS job_operations CASCADE;
DROP TABLE IF EXISTS job_operation_chains CASCADE;
