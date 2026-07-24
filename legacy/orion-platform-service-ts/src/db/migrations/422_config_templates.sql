-- Migration 422: Config Templates
-- Supports configuration templates for environment promotion

CREATE TABLE IF NOT EXISTS config_templates (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  config_data JSONB NOT NULL DEFAULT '{}',
  target_environment VARCHAR(50) NOT NULL DEFAULT 'dev',
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR(64) NOT NULL,
  updated_by VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_templates_tenant ON config_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_templates_category ON config_templates(category);
CREATE INDEX IF NOT EXISTS idx_config_templates_target_env ON config_templates(target_environment);
CREATE INDEX IF NOT EXISTS idx_config_templates_tenant_category ON config_templates(tenant_id, category);

CREATE TABLE IF NOT EXISTS config_template_versions (
  id VARCHAR(100) PRIMARY KEY,
  template_id VARCHAR(100) NOT NULL REFERENCES config_templates(id) ON DELETE CASCADE,
  config_data JSONB NOT NULL DEFAULT '{}',
  version INT NOT NULL DEFAULT 1,
  change_log TEXT,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_template_versions_template ON config_template_versions(template_id);

-- Rollback:
-- DROP TABLE IF EXISTS config_template_versions, config_templates;
