-- 090: Artifacts Persistence
-- 正式 artifacts 表，用于替代 ArtifactService 中的 Map 内存存储
-- 对应 Phase 1 规格: phase1/02-artifact-spec.md

CREATE TABLE IF NOT EXISTS artifacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  type            VARCHAR(50) NOT NULL DEFAULT 'other',
  storage_type    VARCHAR(20) NOT NULL DEFAULT 'local',
  storage_path    VARCHAR(500) NOT NULL,
  size_bytes      BIGINT NOT NULL DEFAULT 0,
  checksum_sha256 VARCHAR(64),
  run_id          UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  stage_id        UUID REFERENCES stage_executions(id) ON DELETE SET NULL,
  expires_at      TIMESTAMPTZ,
  downloaded_count INT NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_artifacts_tenant ON artifacts(tenant_id);
CREATE INDEX idx_artifacts_run ON artifacts(run_id);
CREATE INDEX idx_artifacts_stage ON artifacts(stage_id);
CREATE INDEX idx_artifacts_type ON artifacts(type);
CREATE INDEX idx_artifacts_expires ON artifacts(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_artifacts_created ON artifacts(created_at DESC);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- artifacts
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_artifacts ON artifacts
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_artifacts_tenant_rls ON artifacts(tenant_id);

COMMENT ON POLICY tenant_isolation_artifacts ON artifacts IS
    'Tenant isolation RLS policy - artifacts visible only to owning tenant';
