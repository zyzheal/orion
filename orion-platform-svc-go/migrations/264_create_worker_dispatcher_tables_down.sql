-- Reverse 264_create_worker_dispatcher_tables.sql.
-- Drops 3 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS worker_capabilities CASCADE;
DROP TABLE IF EXISTS worker_assignments CASCADE;
DROP TABLE IF EXISTS worker_policies CASCADE;
