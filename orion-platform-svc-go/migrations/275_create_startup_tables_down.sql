-- Reverse 275_create_startup_tables.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS startup_dependencies CASCADE;
DROP TABLE IF EXISTS startup_modules CASCADE;
