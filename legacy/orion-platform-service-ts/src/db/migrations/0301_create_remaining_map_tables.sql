-- Migration 0301: Create remaining tables for Map() to PostgreSQL migration
--
-- Most services already have their tables (covered by earlier migrations):
--   - RiskAssessment:      risk_assessments (migration 196)
--   - AbacPolicyEngine:    abac_policies (migration 050)
--   - ClusterHealthMonitor: cluster_records, cluster_health_checks, cluster_metrics, cluster_anomalies (migration 0298)
--   - PluginManager:        plugins (earlier migration)
--   - ExecutionTimeline:    execution_timelines, execution_events (migration 131)
--   - AutoRecovery:         auto_recovery_records (migration 196), auto_recovery_degraded_state (migration 0297)
--
-- This migration covers the ONLY remaining gap:
--   - BackupRestoreService: backup_records (NEW)

-- ==================== Backup Records ====================
-- Stores actual backup execution records (distinct from backup_configs which store schedule/config)

CREATE TABLE IF NOT EXISTS backup_records (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  scope VARCHAR(50) NOT NULL DEFAULT 'full',          -- 'full', 'incremental', 'config-only', 'data-only'
  status VARCHAR(50) NOT NULL DEFAULT 'pending',      -- 'pending', 'in_progress', 'completed', 'failed', 'restoring', 'deleted'
  size_bytes BIGINT,
  file_path VARCHAR(1000),
  description TEXT,
  retention_days INTEGER NOT NULL DEFAULT 30,
  expires_at TIMESTAMP,
  include_services JSONB DEFAULT '[]',
  exclude_services JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_records_tenant ON backup_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_backup_records_status ON backup_records(status);
CREATE INDEX IF NOT EXISTS idx_backup_records_created ON backup_records(created_at);
CREATE INDEX IF NOT EXISTS idx_backup_records_expires ON backup_records(expires_at);

COMMENT ON TABLE backup_records IS 'Backup execution records for disaster recovery - tracks actual backup operations';
