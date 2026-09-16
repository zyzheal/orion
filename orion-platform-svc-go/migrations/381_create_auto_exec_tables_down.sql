-- Reverse 381_create_auto_exec_tables.sql.
-- Drops 3 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS plugin_spi CASCADE;
DROP TABLE IF EXISTS execution_history CASCADE;
DROP TABLE IF EXISTS execution_tasks CASCADE;
