-- Rollback: 389_create_federation_advanced_tables.sql
DROP TABLE IF EXISTS federation_resource_pools;
DROP TABLE IF EXISTS federation_cross_cluster_jobs;
DROP TABLE IF EXISTS federation_scheduling_policies;
