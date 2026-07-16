-- Rollback Migration 453: Drop service_registry table
-- Drops indexes first, then table

-- DROP INDEX IF EXISTS idx_service_registry_updated;
-- DROP INDEX IF EXISTS idx_service_registry_health;
-- DROP INDEX IF EXISTS idx_service_registry_status;
-- DROP INDEX IF EXISTS idx_service_registry_service_id;
-- DROP INDEX IF EXISTS idx_service_registry_tenant;
-- DROP TABLE IF EXISTS service_registry;
