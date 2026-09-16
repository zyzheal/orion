-- Reverse 247_create_data_catalog.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS data_catalog_entries CASCADE;
