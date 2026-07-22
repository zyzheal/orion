-- Migration 008: Environments
-- Deployment environment definitions

CREATE TABLE IF NOT EXISTS environments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  name          VARCHAR(200) NOT NULL,
  type          VARCHAR(50) NOT NULL,
  cluster       VARCHAR(200),
  namespace     VARCHAR(200),
  config        JSONB NOT NULL DEFAULT '{}',
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);
CREATE INDEX idx_environments_tenant ON environments(tenant_id);
CREATE INDEX idx_environments_project ON environments(project_id);

-- Rollback:
-- DROP TABLE IF EXISTS environments;
