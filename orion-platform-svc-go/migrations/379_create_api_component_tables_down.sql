-- Reverse 379_create_api_component_tables.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS api_component_routes CASCADE;
DROP TABLE IF EXISTS api_components CASCADE;
