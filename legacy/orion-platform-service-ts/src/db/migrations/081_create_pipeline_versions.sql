-- Migration 081: Pipeline Versions (Phase 1)
-- 版本控制增强

CREATE TABLE IF NOT EXISTS pipeline_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  yaml_definition TEXT NOT NULL,
  spec            JSONB NOT NULL DEFAULT '{}',
  change_summary  TEXT,
  tags            TEXT[] DEFAULT '{}',
  is_baseline     BOOLEAN DEFAULT false,
  parent_version_id UUID REFERENCES pipeline_versions(id),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id, version)
);

CREATE INDEX idx_pipeline_versions_pipeline ON pipeline_versions(pipeline_id, version DESC);
CREATE INDEX idx_pipeline_versions_tags ON pipeline_versions(tags);
CREATE INDEX idx_pipeline_versions_baseline ON pipeline_versions(pipeline_id, is_baseline) WHERE is_baseline = true;

-- Pipeline Budgets
CREATE TABLE IF NOT EXISTS pipeline_budgets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  time_budget     JSONB DEFAULT '{"maxDurationMs": 3600000, "warningPercent": 80, "policy": "warn"}',
  resource_budget JSONB DEFAULT '{"maxCpuCoreHours": 100, "maxMemoryGBHours": 200, "warningPercent": 80, "policy": "warn"}',
  cost_budget     JSONB DEFAULT '{"maxCostCents": 10000, "warningPercent": 80, "policy": "warn"}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id)
);

CREATE INDEX idx_pipeline_budgets_pipeline ON pipeline_budgets(pipeline_id);

-- Pipeline Templates
CREATE TABLE IF NOT EXISTS pipeline_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50) DEFAULT 'general',
  tags            TEXT[] DEFAULT '{}',
  yaml_definition TEXT NOT NULL,
  version         INT NOT NULL DEFAULT 1,
  is_public       BOOLEAN DEFAULT false,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_templates_tenant ON pipeline_templates(tenant_id);
CREATE INDEX idx_pipeline_templates_category ON pipeline_templates(category);
CREATE INDEX idx_pipeline_templates_public ON pipeline_templates(is_public) WHERE is_public = true;
