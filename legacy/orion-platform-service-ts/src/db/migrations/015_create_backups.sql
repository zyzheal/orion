-- Migration 015: Backup & Recovery
-- Backup job definitions and execution records

CREATE TABLE IF NOT EXISTS backup_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  type          VARCHAR(50) NOT NULL,
  target        JSONB NOT NULL,
  schedule      VARCHAR(100),
  retention_days INT NOT NULL DEFAULT 30,
  encryption_key VARCHAR(255),
  storage_config JSONB NOT NULL,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_backup_configs_tenant ON backup_configs(tenant_id);

-- Backup jobs
CREATE TABLE IF NOT EXISTS backup_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  config_id     UUID REFERENCES backup_configs(id) ON DELETE SET NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'running',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  size_bytes    BIGINT,
  storage_path  VARCHAR(500),
  error_message TEXT
);
CREATE INDEX idx_backup_jobs_tenant ON backup_jobs(tenant_id);
CREATE INDEX idx_backup_jobs_status ON backup_jobs(status);

-- Backup restore jobs
CREATE TABLE IF NOT EXISTS backup_restores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  backup_job_id UUID NOT NULL REFERENCES backup_jobs(id) ON DELETE CASCADE,
  status        VARCHAR(20) NOT NULL DEFAULT 'running',
  requested_by  UUID REFERENCES users(id),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rollback:
-- DROP TABLE IF EXISTS backup_restores, backup_jobs, backup_configs;
