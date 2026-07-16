-- Rollback Migration 016_create_configs
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: configs
DROP TABLE IF EXISTS configs CASCADE;

-- Dropping table: config_history
DROP TABLE IF EXISTS config_history CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_config;
DROP INDEX IF EXISTS CREATE INDEX idx_config;
DROP INDEX IF EXISTS CREATE INDEX idx_config_hi;
