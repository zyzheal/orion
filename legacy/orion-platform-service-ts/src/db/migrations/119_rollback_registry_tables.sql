-- Rollback Migration 119: Drop nats_registry and k8s_provisioner tables

DROP TABLE IF EXISTS federation_executor_health CASCADE;
DROP TABLE IF EXISTS federation_executors CASCADE;
DROP TABLE IF EXISTS k8s_namespaces CASCADE;
DROP TABLE IF EXISTS service_instances CASCADE;
