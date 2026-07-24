-- Rollback Migration 053_create_build_cache_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: build_cache_configs
DROP TABLE IF EXISTS build_cache_configs CASCADE;

-- Dropping table: build_cache_entries
DROP TABLE IF EXISTS build_cache_entries CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_build_cache_config;
DROP INDEX IF EXISTS CREATE INDEX idx_build_cache_config;
DROP INDEX IF EXISTS CREATE INDEX idx_build_cache_entrie;
DROP INDEX IF EXISTS CREATE INDEX idx_build_cache_entrie;
DROP INDEX IF EXISTS CREATE INDEX idx_build_cache_entrie;
DROP INDEX IF EXISTS CREATE INDEX idx_build_cache_entrie;
