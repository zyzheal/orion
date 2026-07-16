-- Migration 303: Create table for Developer Portal SDK Generation Tasks
-- Table: devportal_sdk_tasks

CREATE TABLE IF NOT EXISTS devportal_sdk_tasks (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name VARCHAR(255) NOT NULL,
  api_spec TEXT NOT NULL,
  language VARCHAR(20) NOT NULL,
  package_name VARCHAR(255) NOT NULL,
  version VARCHAR(32) DEFAULT '1.0.0',
  status VARCHAR(20) DEFAULT 'pending',
  output TEXT DEFAULT '',
  error TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sdk_tasks_tenant ON devportal_sdk_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sdk_tasks_status ON devportal_sdk_tasks(status);
CREATE INDEX IF NOT EXISTS idx_sdk_tasks_language ON devportal_sdk_tasks(tenant_id, language);
