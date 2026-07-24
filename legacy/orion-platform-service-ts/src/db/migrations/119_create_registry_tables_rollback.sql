-- Rollback Migration 119_create_registry_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: service_instances
DROP TABLE IF EXISTS service_instances CASCADE;

-- Dropping table: k8s_namespaces
DROP TABLE IF EXISTS k8s_namespaces CASCADE;

-- Dropping table: federation_executors
DROP TABLE IF EXISTS federation_executors CASCADE;

-- Dropping table: federation_executor_health
DROP TABLE IF EXISTS federation_executor_health CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_k8;
DROP INDEX IF EXISTS CREATE INDEX idx_k8;
DROP INDEX IF EXISTS CREATE INDEX idx_k8;
DROP INDEX IF EXISTS CREATE INDEX idx_federation_executor;
DROP INDEX IF EXISTS CREATE INDEX idx_federation_executor;
DROP INDEX IF EXISTS CREATE INDEX idx_federation_executor_health_executor ON federation_executor_health(executor_id);;
