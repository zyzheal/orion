-- Reverse 378_create_cache_monitor_tables.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS cache_configs CASCADE;
DROP TABLE IF EXISTS cache_metrics CASCADE;
