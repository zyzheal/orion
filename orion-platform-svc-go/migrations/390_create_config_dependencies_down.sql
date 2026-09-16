-- Reverse 390_create_config_dependencies.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS config_dependencies CASCADE;
