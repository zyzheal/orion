-- ============================================================
-- Rollback Migration 413: DataPipeline Version Management
-- ============================================================
-- Reverses the schema changes introduced by
-- 413_pipeline_version_management.sql
--
-- WARNING: Rolling back will DELETE all pipeline version history
-- data because DROP TABLE removes all rows.
-- ============================================================

-- Drop indexes first
DROP INDEX IF EXISTS idx_pv_tenant_pipeline;
DROP INDEX IF EXISTS idx_pv_pipeline;

-- Drop the table
DROP TABLE IF EXISTS pipeline_versions;
