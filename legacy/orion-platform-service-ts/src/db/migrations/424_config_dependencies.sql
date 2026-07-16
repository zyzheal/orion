-- Migration 424: Config Dependencies
-- Supports dependency graph for configuration items

CREATE TABLE IF NOT EXISTS config_dependencies (
  id VARCHAR(100) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  config_id VARCHAR(100) NOT NULL REFERENCES config_entries(id) ON DELETE CASCADE,
  depends_on_config_id VARCHAR(100) NOT NULL REFERENCES config_entries(id) ON DELETE CASCADE,
  dependency_type VARCHAR(30) NOT NULL DEFAULT 'hard',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, config_id, depends_on_config_id)
);

CREATE INDEX IF NOT EXISTS idx_config_dependencies_tenant ON config_dependencies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_dependencies_config ON config_dependencies(config_id);
CREATE INDEX IF NOT EXISTS idx_config_dependencies_depends_on ON config_dependencies(depends_on_config_id);
CREATE INDEX IF NOT EXISTS idx_config_dependencies_tenant_config ON config_dependencies(tenant_id, config_id);

-- Rollback:
-- DROP TABLE IF EXISTS config_dependencies;
