-- Reverse 386_create_global_search_tables.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS global_search_statuses CASCADE;
DROP TABLE IF EXISTS global_search_configs CASCADE;
