-- Rollback Migration 125: Remove tenant_id columns from canary_traffic and federation tables

-- Drop indexes
DROP INDEX IF EXISTS idx_federation_executor_health_tenant;
DROP INDEX IF EXISTS idx_federation_executors_tenant;
DROP INDEX IF EXISTS idx_canary_traffic_history_tenant;
DROP INDEX IF EXISTS idx_canary_traffic_configs_tenant;

-- Drop columns
ALTER TABLE federation_executor_health DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE federation_executors DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE canary_traffic_history DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE canary_traffic_configs DROP COLUMN IF EXISTS tenant_id;
