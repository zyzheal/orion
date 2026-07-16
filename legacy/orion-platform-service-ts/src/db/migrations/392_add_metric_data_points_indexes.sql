-- Migration 392: Add composite index on metric_data_points for multi-tenant metric queries
--
-- This index optimizes the most common query pattern:
--   SELECT * FROM metric_data_points WHERE tenant_id = $1 AND metric_name = $2 AND timestamp >= $3
--
-- Without this index, these queries do a sequential scan on the entire table,
-- which is unacceptable as metric data grows. The composite index ensures
-- efficient index-only scans for tenant-scoped metric lookups.

-- Create composite index for tenant + metric + time range queries
CREATE INDEX IF NOT EXISTS idx_metric_data_points_tenant_metric_time
  ON metric_data_points (tenant_id, metric_name, timestamp DESC);

-- Create index for tenant-only queries (e.g., listing all metrics for a tenant)
CREATE INDEX IF NOT EXISTS idx_metric_data_points_tenant_id
  ON metric_data_points (tenant_id);

-- Verify the indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'metric_data_points'
  AND indexname IN (
    'idx_metric_data_points_tenant_metric_time',
    'idx_metric_data_points_tenant_id'
  );
