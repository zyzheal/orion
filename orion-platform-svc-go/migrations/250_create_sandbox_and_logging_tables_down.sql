-- Reverse 250_create_sandbox_and_logging_tables.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS log_entries CASCADE;
DROP TABLE IF EXISTS sandbox_jobs CASCADE;
