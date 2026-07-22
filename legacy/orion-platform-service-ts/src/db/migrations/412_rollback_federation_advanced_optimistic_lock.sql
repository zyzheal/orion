-- Rollback: 412_federation_advanced_optimistic_lock.sql
-- Purpose: Remove optimistic lock and audit log support for federation advanced tables

DROP TABLE IF EXISTS federation_audit_logs CASCADE;

ALTER TABLE federation_scheduling_policies DROP COLUMN IF EXISTS version;
ALTER TABLE federation_cross_cluster_jobs DROP COLUMN IF EXISTS version;
ALTER TABLE federation_resource_pools DROP COLUMN IF EXISTS version;
