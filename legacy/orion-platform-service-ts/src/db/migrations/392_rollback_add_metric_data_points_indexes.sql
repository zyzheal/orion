-- Rollback Migration 392: Drop metric_data_points indexes

DROP INDEX IF EXISTS idx_metric_data_points_tenant_metric_time;
DROP INDEX IF EXISTS idx_metric_data_points_tenant_id;
