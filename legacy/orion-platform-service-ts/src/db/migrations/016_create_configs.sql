-- Migration 016: Configuration Management
-- System and application configuration storage

CREATE TABLE IF NOT EXISTS configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  namespace     VARCHAR(100) NOT NULL,
  key           VARCHAR(200) NOT NULL,
  value         JSONB NOT NULL,
  description   TEXT,
  encrypted     BOOLEAN NOT NULL DEFAULT false,
  version       INT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, namespace, key)
);
CREATE INDEX idx_configs_tenant ON configs(tenant_id);
CREATE INDEX idx_configs_namespace ON configs(namespace);

-- Config change history
CREATE TABLE IF NOT EXISTS config_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id     UUID NOT NULL REFERENCES configs(id) ON DELETE CASCADE,
  old_value     JSONB,
  new_value     JSONB NOT NULL,
  changed_by    UUID REFERENCES users(id),
  change_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_config_history_config ON config_history(config_id);

-- Rollback:
-- DROP TABLE IF EXISTS config_history, configs;
