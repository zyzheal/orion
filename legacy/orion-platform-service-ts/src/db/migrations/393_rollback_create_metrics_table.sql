-- Rollback: drop metrics table indexes and table
DROP INDEX IF EXISTS idx_metrics_tenant_name_time;
DROP TABLE IF EXISTS metrics;
