-- Rollback Migration 019_create_efficiency
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: efficiency_metrics
DROP TABLE IF EXISTS efficiency_metrics CASCADE;

-- Dropping table: dora_snapshots
DROP TABLE IF EXISTS dora_snapshots CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_efficiency_metric;
DROP INDEX IF EXISTS CREATE INDEX idx_efficiency_metric;
DROP INDEX IF EXISTS CREATE INDEX idx_efficiency_metric;
DROP INDEX IF EXISTS CREATE INDEX idx_dora_;
