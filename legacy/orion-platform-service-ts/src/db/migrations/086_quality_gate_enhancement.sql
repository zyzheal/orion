-- 086: Quality Gate Enhancement
-- 新增策略覆盖、豁免机制和质量门禁快照表

-- policy_overrides 表（持久化 Override）
CREATE TABLE IF NOT EXISTS policy_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id       VARCHAR(100) NOT NULL,
  override_type   VARCHAR(30) NOT NULL DEFAULT 'temporary',  -- temporary, permanent, emergency
  original_value  JSONB NOT NULL DEFAULT '{}',
  override_value  JSONB NOT NULL DEFAULT '{}',
  reason          TEXT NOT NULL,
  approved_by     VARCHAR(100),
  approved_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_policy_overrides_tenant ON policy_overrides(tenant_id);
CREATE INDEX idx_policy_overrides_policy ON policy_overrides(policy_id);
CREATE INDEX idx_policy_overrides_type ON policy_overrides(override_type);
CREATE INDEX idx_policy_overrides_expires ON policy_overrides(expires_at) WHERE expires_at IS NOT NULL;

-- policy_exemptions 表（豁免机制）
CREATE TABLE IF NOT EXISTS policy_exemptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id       VARCHAR(100) NOT NULL,
  scope_type      VARCHAR(30) NOT NULL DEFAULT 'project',   -- project, pipeline, stage
  scope_id        UUID NOT NULL,
  reason          TEXT NOT NULL,
  granted_by      VARCHAR(100) NOT NULL,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  revoked_by      VARCHAR(100),
  revoked_at      TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_policy_exemptions_tenant ON policy_exemptions(tenant_id);
CREATE INDEX idx_policy_exemptions_policy ON policy_exemptions(policy_id);
CREATE INDEX idx_policy_exemptions_scope ON policy_exemptions(scope_type, scope_id);
CREATE INDEX idx_policy_exemptions_active ON policy_exemptions(revoked_at) WHERE revoked_at IS NULL;

-- quality_gate_snapshots 表（趋势分析快照）
CREATE TABLE IF NOT EXISTS quality_gate_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  run_id          UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  gate_result     VARCHAR(20) NOT NULL,  -- passed, failed, warned, skipped
  total_checks    INT NOT NULL DEFAULT 0,
  passed_checks   INT NOT NULL DEFAULT 0,
  failed_checks   INT NOT NULL DEFAULT 0,
  warned_checks   INT NOT NULL DEFAULT 0,
  skipped_checks  INT NOT NULL DEFAULT 0,
  scores          JSONB NOT NULL DEFAULT '{}',
  violations      JSONB NOT NULL DEFAULT '[]',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quality_gate_snapshots_tenant ON quality_gate_snapshots(tenant_id);
CREATE INDEX idx_quality_gate_snapshots_pipeline ON quality_gate_snapshots(pipeline_id);
CREATE INDEX idx_quality_gate_snapshots_run ON quality_gate_snapshots(run_id);
CREATE INDEX idx_quality_gate_snapshots_result ON quality_gate_snapshots(gate_result);
CREATE INDEX idx_quality_gate_snapshots_created ON quality_gate_snapshots(created_at DESC);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- policy_overrides
ALTER TABLE policy_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_overrides FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_overrides ON policy_overrides
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_policy_overrides_tenant_rls ON policy_overrides(tenant_id);

COMMENT ON POLICY tenant_isolation_policy_overrides ON policy_overrides IS
    'Tenant isolation RLS policy - policy overrides visible only to owning tenant';

-- policy_exemptions
ALTER TABLE policy_exemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_exemptions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_exemptions ON policy_exemptions
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_policy_exemptions_tenant_rls ON policy_exemptions(tenant_id);

COMMENT ON POLICY tenant_isolation_policy_exemptions ON policy_exemptions IS
    'Tenant isolation RLS policy - policy exemptions visible only to owning tenant';

-- quality_gate_snapshots
ALTER TABLE quality_gate_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_gate_snapshots FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_quality_gate_snapshots ON quality_gate_snapshots
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_quality_gate_snapshots_tenant_rls ON quality_gate_snapshots(tenant_id);

COMMENT ON POLICY tenant_isolation_quality_gate_snapshots ON quality_gate_snapshots IS
    'Tenant isolation RLS policy - quality gate snapshots visible only to owning tenant';
