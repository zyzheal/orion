-- Rollback Migration 112_federation_advanced
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: cross_cluster_scheduling
DROP TABLE IF EXISTS cross_cluster_scheduling CASCADE;

-- Dropping table: policy_engines
DROP TABLE IF EXISTS policy_engines CASCADE;

-- Dropping table: resource_pools
DROP TABLE IF EXISTS resource_pools CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_cro;
DROP INDEX IF EXISTS CREATE INDEX idx_cro;
DROP INDEX IF EXISTS CREATE INDEX idx_cro;
DROP INDEX IF EXISTS CREATE INDEX idx_cro;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_engine;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_engine;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_engine;
DROP INDEX IF EXISTS CREATE INDEX idx_policy_engine;
DROP INDEX IF EXISTS CREATE INDEX idx_re;
DROP INDEX IF EXISTS CREATE INDEX idx_re;
DROP INDEX IF EXISTS CREATE INDEX idx_re;
DROP INDEX IF EXISTS CREATE INDEX idx_re;
