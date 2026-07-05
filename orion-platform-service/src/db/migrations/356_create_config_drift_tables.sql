-- migration: 356_create_config_drift_reports
-- desc: config drift detection reports with PostgreSQL persistence
-- parent: 355_create_data_pipeline_tables

CREATE TABLE IF NOT EXISTS config_drift_reports (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  config_group VARCHAR(255),
  drift_status VARCHAR(50) NOT NULL DEFAULT 'in_sync',
  expected_config JSONB NOT NULL DEFAULT '{}',
  actual_config JSONB NOT NULL DEFAULT '{}',
  drift_items JSONB NOT NULL DEFAULT '[]',
  total_drifts INTEGER NOT NULL DEFAULT 0,
  critical_drifts INTEGER NOT NULL DEFAULT 0,
  auto_remediation_enabled BOOLEAN NOT NULL DEFAULT false,
  remediation_log JSONB NOT NULL DEFAULT '[]',
  detected_at TIMESTAMPTZ NOT NULL,
  last_checked_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

-- Index: lookup by tenant
CREATE INDEX IF NOT EXISTS idx_config_drift_reports_tenant_id
  ON config_drift_reports (tenant_id);

-- Index: lookup by tenant + config_group
CREATE INDEX IF NOT EXISTS idx_config_drift_reports_tenant_group
  ON config_drift_reports (tenant_id, config_group);

-- Index: lookup by drift status
CREATE INDEX IF NOT EXISTS idx_config_drift_reports_drift_status
  ON config_drift_reports (drift_status);
