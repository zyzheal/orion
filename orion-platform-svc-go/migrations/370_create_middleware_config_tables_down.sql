-- Reverse 370_create_middleware_config_tables.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS middleware_configs CASCADE;
