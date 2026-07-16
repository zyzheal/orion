-- Migration 264: Metric Collector - additional indexes for PostgreSQL Repository pattern
-- Ensures metric_registry and metric_data_points tables (from 0183) have proper indexes
-- for MetricCollector repository-based queries.

-- metric_registry and metric_data_points tables already exist from migration 0183
-- This migration adds additional performance indexes for common query patterns

CREATE INDEX IF NOT EXISTS idx_metric_registry_tenant_name ON metric_registry(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_metric_points_name_tenant_ts ON metric_data_points(metric_name, tenant_id, timestamp DESC);
