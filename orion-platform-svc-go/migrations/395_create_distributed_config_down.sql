-- Reverse 395_create_distributed_config.sql.
-- Drops 8 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS config_audit CASCADE;
DROP TABLE IF EXISTS config_release_history CASCADE;
DROP TABLE IF EXISTS config_release CASCADE;
DROP TABLE IF EXISTS config_snapshot CASCADE;
DROP TABLE IF EXISTS config_item_history CASCADE;
DROP TABLE IF EXISTS config_item CASCADE;
DROP TABLE IF EXISTS config_group CASCADE;
DROP TABLE IF EXISTS config_namespace CASCADE;
