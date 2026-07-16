-- Rollback Migration 022_create_api_keys
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: api_keys
DROP TABLE IF EXISTS api_keys CASCADE;

-- Dropping table: rate_limits
DROP TABLE IF EXISTS rate_limits CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_api_key;
