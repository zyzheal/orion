-- Reverse 690_create_infrastructure_orphan_tables.sql.
-- Drops the 12 infrastructure-domain orphan tables and their indexes.

DROP INDEX IF EXISTS idx_twin_sandboxes_status;
DROP INDEX IF EXISTS idx_twin_sandboxes_tenant;
DROP TABLE IF EXISTS twin_sandboxes;

DROP INDEX IF EXISTS idx_twin_snapshots_status;
DROP INDEX IF EXISTS idx_twin_snapshots_tenant;
DROP TABLE IF EXISTS twin_snapshots;

DROP INDEX IF EXISTS idx_serverless_metrics_tenant;
DROP TABLE IF EXISTS serverless_metrics;

DROP INDEX IF EXISTS idx_serverless_logs_tenant;
DROP TABLE IF EXISTS serverless_logs;

DROP INDEX IF EXISTS idx_scaling_policies_tenant;
DROP TABLE IF EXISTS scaling_policies;

DROP INDEX IF EXISTS idx_multicloud_providers_tenant;
DROP TABLE IF EXISTS multicloud_providers;

DROP INDEX IF EXISTS idx_dba_query_logs_tenant;
DROP TABLE IF EXISTS dba_query_logs;

DROP INDEX IF EXISTS idx_dba_orders_status;
DROP INDEX IF EXISTS idx_dba_orders_tenant;
DROP TABLE IF EXISTS dba_orders;

DROP INDEX IF EXISTS idx_capacity_reports_tenant;
DROP TABLE IF EXISTS capacity_reports;

DROP INDEX IF EXISTS idx_capacity_metrics_tenant;
DROP TABLE IF EXISTS capacity_metrics;

DROP INDEX IF EXISTS idx_capacity_forecasts_tenant;
DROP TABLE IF EXISTS capacity_forecasts;

DROP INDEX IF EXISTS idx_capacity_alerts_severity;
DROP INDEX IF EXISTS idx_capacity_alerts_tenant;
DROP TABLE IF EXISTS capacity_alerts;