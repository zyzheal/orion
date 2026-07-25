-- Rollback for migration 255: drop method-level cache management tables.
DROP INDEX IF EXISTS idx_cache_stats_last_access;
DROP INDEX IF EXISTS idx_cache_stats_config;
DROP TABLE IF EXISTS cache_stats;

DROP INDEX IF EXISTS idx_cache_configs_name;
DROP INDEX IF EXISTS idx_cache_configs_enabled;
DROP INDEX IF EXISTS idx_cache_configs_tenant;
DROP TABLE IF EXISTS cache_configs;
