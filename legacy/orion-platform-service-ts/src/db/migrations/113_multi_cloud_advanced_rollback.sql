-- Rollback Migration 113_multi_cloud_advanced
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: cross_zone_dr
DROP TABLE IF EXISTS cross_zone_dr CASCADE;

-- Dropping table: multi_cloud_cost
DROP TABLE IF EXISTS multi_cloud_cost CASCADE;

-- Dropping table: cloud_networking
DROP TABLE IF EXISTS cloud_networking CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_cro;
DROP INDEX IF EXISTS CREATE INDEX idx_cro;
DROP INDEX IF EXISTS CREATE INDEX idx_cro;
DROP INDEX IF EXISTS CREATE INDEX idx_cro;
DROP INDEX IF EXISTS CREATE INDEX idx_multi_cloud_co;
DROP INDEX IF EXISTS CREATE INDEX idx_multi_cloud_co;
DROP INDEX IF EXISTS CREATE INDEX idx_multi_cloud_co;
DROP INDEX IF EXISTS CREATE INDEX idx_multi_cloud_co;
DROP INDEX IF EXISTS CREATE INDEX idx_cloud_networking_tenant ON cloud_networking(tenant_id);;
DROP INDEX IF EXISTS CREATE INDEX idx_cloud_networking_provider ON cloud_networking(cloud_provider);;
DROP INDEX IF EXISTS CREATE INDEX idx_cloud_networking_type ON cloud_networking(network_type);;
DROP INDEX IF EXISTS CREATE INDEX idx_cloud_networking_;
DROP INDEX IF EXISTS CREATE INDEX idx_cloud_networking_region ON cloud_networking(region);;
