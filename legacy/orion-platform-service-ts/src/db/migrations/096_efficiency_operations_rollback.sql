-- Rollback Migration 096_efficiency_operations
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: developer_profiles
DROP TABLE IF EXISTS developer_profiles CASCADE;

-- Dropping table: efficiency_metrics
DROP TABLE IF EXISTS efficiency_metrics CASCADE;

-- Dropping table: efficiency_dashboard_snapshots
DROP TABLE IF EXISTS efficiency_dashboard_snapshots CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_developer_profile;
DROP INDEX IF EXISTS CREATE INDEX idx_developer_profile;
DROP INDEX IF EXISTS CREATE INDEX idx_efficiency_metric;
DROP INDEX IF EXISTS CREATE INDEX idx_efficiency_metric;
DROP INDEX IF EXISTS CREATE INDEX idx_efficiency_metric;
DROP INDEX IF EXISTS CREATE INDEX idx_efficiency_metric;
DROP INDEX IF EXISTS CREATE INDEX idx_efficiency_da;
DROP INDEX IF EXISTS CREATE INDEX idx_efficiency_da;
DROP INDEX IF EXISTS idx_developer_profile;
DROP INDEX IF EXISTS idx_efficiency_metric;
DROP INDEX IF EXISTS idx_efficiency_da;
