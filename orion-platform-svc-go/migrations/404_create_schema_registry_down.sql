-- Reverse 404_create_schema_registry.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS schema_registry_versions CASCADE;
DROP TABLE IF EXISTS schema_registry CASCADE;
