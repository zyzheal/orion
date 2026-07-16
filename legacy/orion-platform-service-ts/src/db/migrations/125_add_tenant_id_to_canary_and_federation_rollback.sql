-- Rollback Migration 125_add_tenant_id_to_canary_and_federation
-- Auto-generated rollback script
-- Review carefully before executing in production

DROP INDEX IF EXISTS CREATE INDEX idx_canary_traffic_config;
DROP INDEX IF EXISTS CREATE INDEX idx_canary_traffic_hi;
DROP INDEX IF EXISTS CREATE INDEX idx_federation_executor;
DROP INDEX IF EXISTS CREATE INDEX idx_federation_executor_health_tenant ON federation_executor_health(tenant_id);;
