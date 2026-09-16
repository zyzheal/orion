-- Reverse 251_add_database_name_to_data_catalog.sql.
-- Drop the database_name column and its index.

DROP INDEX IF EXISTS idx_data_catalog_entries_database;
ALTER TABLE data_catalog_entries DROP COLUMN IF EXISTS database_name;
