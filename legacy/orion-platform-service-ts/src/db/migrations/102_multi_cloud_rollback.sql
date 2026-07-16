-- Rollback Migration 102_multi_cloud
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: cloud_providers
DROP TABLE IF EXISTS cloud_providers CASCADE;

-- Dropping table: cloud_accounts
DROP TABLE IF EXISTS cloud_accounts CASCADE;

-- Dropping table: cloud_resources
DROP TABLE IF EXISTS cloud_resources CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_cloud_provider;
DROP INDEX IF EXISTS CREATE INDEX idx_cloud_provider;
DROP INDEX IF EXISTS CREATE INDEX idx_cloud_provider;
DROP INDEX IF EXISTS CREATE INDEX idx_cloud_account;
DROP INDEX IF EXISTS CREATE INDEX idx_cloud_account;
DROP INDEX IF EXISTS CREATE INDEX idx_cloud_account;
DROP INDEX IF EXISTS CREATE INDEX idx_cloud_account;
DROP INDEX IF EXISTS CREATE INDEX idx_cloud_re;
DROP INDEX IF EXISTS CREATE INDEX idx_cloud_re;
DROP INDEX IF EXISTS CREATE INDEX idx_cloud_re;
DROP INDEX IF EXISTS CREATE INDEX idx_cloud_re;
DROP INDEX IF EXISTS CREATE INDEX idx_cloud_re;
