-- Migration 006: Build Images & Build Environments
-- Build environment configurations and image registries

CREATE TABLE IF NOT EXISTS build_environments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  type          VARCHAR(50) NOT NULL,
  image         VARCHAR(500) NOT NULL,
  description   TEXT,
  config        JSONB NOT NULL DEFAULT '{}',
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);
CREATE INDEX idx_build_envs_tenant ON build_environments(tenant_id);

-- Build records
CREATE TABLE IF NOT EXISTS builds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  image         VARCHAR(500),
  tag           VARCHAR(200),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  source_ref    VARCHAR(500),
  build_args    JSONB NOT NULL DEFAULT '{}',
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  duration_ms   BIGINT,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_builds_tenant ON builds(tenant_id);
CREATE INDEX idx_builds_project ON builds(project_id);
CREATE INDEX idx_builds_status ON builds(status);

-- Rollback:
-- DROP TABLE IF EXISTS builds, build_environments;
