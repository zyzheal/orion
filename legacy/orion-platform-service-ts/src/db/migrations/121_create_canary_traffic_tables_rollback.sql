-- Rollback Migration 121_create_canary_traffic_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: canary_traffic_configs
DROP TABLE IF EXISTS canary_traffic_configs CASCADE;

-- Dropping table: canary_traffic_history
DROP TABLE IF EXISTS canary_traffic_history CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_canary_traffic_config;
DROP INDEX IF EXISTS CREATE INDEX idx_canary_traffic_config;
DROP INDEX IF EXISTS CREATE INDEX idx_canary_traffic_config;
DROP INDEX IF EXISTS CREATE INDEX idx_canary_traffic_hi;
DROP INDEX IF EXISTS CREATE INDEX idx_canary_traffic_hi;
DROP INDEX IF EXISTS CREATE INDEX idx_canary_traffic_hi;
