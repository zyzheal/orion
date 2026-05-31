-- Migration 293: EnvironmentRepository Map() to PostgreSQL
-- Migrates environments from in-memory Map storage to persistent PostgreSQL

CREATE TABLE IF NOT EXISTS environments (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  project_id VARCHAR(200) NOT NULL,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'development',
  cluster VARCHAR(200),
  namespace VARCHAR(200),
  config TEXT NOT NULL DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_by VARCHAR(200),
  locked_at TIMESTAMP,
  locked_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_environments_project_id ON environments(project_id);
CREATE INDEX IF NOT EXISTS idx_environments_tenant ON environments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_environments_status ON environments(status);
CREATE INDEX IF NOT EXISTS idx_environments_type ON environments(type);
