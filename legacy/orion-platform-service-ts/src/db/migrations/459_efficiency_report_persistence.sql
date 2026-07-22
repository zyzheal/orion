-- Migration 459: Efficiency Report Service - DB-first persistence
-- Ensures all 5 in-memory Maps in EfficiencyReportService are backed by PostgreSQL.
-- Tables were created in migration 193; this migration adds any missing indexes
-- and documents the persistence contract.

-- ==================== Global Deployments ====================
-- Standalone tenant_id index for queries that filter only by tenant
-- (the composite index from migration 193 covers (tenant_id, deployed_at DESC))
CREATE INDEX IF NOT EXISTS idx_eff_global_deploy_tenant_only
  ON efficiency_global_deployments(tenant_id);

-- ==================== Global Pipeline Records ====================
-- Standalone tenant_id index for queries that filter only by tenant
-- (the composite index from migration 193 covers (tenant_id, completed_at DESC))
CREATE INDEX IF NOT EXISTS idx_eff_global_pipelines_tenant_only
  ON efficiency_global_pipelines(tenant_id);

-- ==================== Report History ====================
-- Composite index for tenant-scoped history lookups sorted by generation time
CREATE INDEX IF NOT EXISTS idx_eff_reports_tenant_generated
  ON efficiency_reports(tenant_id, generated_at DESC);
