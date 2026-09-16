-- Reverse 001_create_monitor_tables.sql.
-- Drops 3 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS traces CASCADE;
DROP TABLE IF EXISTS metrics CASCADE;
