-- Migration 004: Pipelines
-- CI/CD pipeline definitions and configurations

CREATE TABLE IF NOT EXISTS pipelines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  trigger_type  VARCHAR(50) NOT NULL DEFAULT 'manual',
  config        JSONB NOT NULL DEFAULT '{}',
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES users(id)
);
CREATE INDEX idx_pipelines_tenant ON pipelines(tenant_id);
CREATE INDEX idx_pipelines_project ON pipelines(project_id);
CREATE INDEX idx_pipelines_status ON pipelines(status);

-- Pipeline stages
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id   UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  type          VARCHAR(50) NOT NULL,
  config        JSONB NOT NULL DEFAULT '{}',
  order_index   INT NOT NULL,
  timeout       INT,
  retry_count   INT NOT NULL DEFAULT 0,
  parallel      BOOLEAN NOT NULL DEFAULT false,
  conditions    JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);
CREATE INDEX idx_pipeline_stages_order ON pipeline_stages(order_index);

-- Stage dependencies
CREATE TABLE IF NOT EXISTS stage_dependencies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id      UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  UNIQUE(stage_id, depends_on_id)
);

-- Rollback:
-- DROP TABLE IF EXISTS stage_dependencies, pipeline_stages, pipelines;
