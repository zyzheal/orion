-- 092: Autonomous Pipeline
-- 自修复、错误分类、自适应超时

CREATE TABLE IF NOT EXISTS pipeline_error_classification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  stage_name VARCHAR(200) NOT NULL,
  error_type VARCHAR(30) NOT NULL,  -- transient, permanent, flaky, config
  error_message TEXT,
  should_retry BOOLEAN NOT NULL DEFAULT false,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_error_classification_tenant ON pipeline_error_classification(tenant_id);
CREATE INDEX idx_pipeline_error_classification_run ON pipeline_error_classification(pipeline_run_id);
CREATE INDEX idx_pipeline_error_classification_type ON pipeline_error_classification(error_type);
CREATE INDEX idx_pipeline_error_classification_created ON pipeline_error_classification(created_at DESC);

CREATE TABLE IF NOT EXISTS pipeline_stage_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  stage_name VARCHAR(200) NOT NULL,
  avg_duration_ms BIGINT NOT NULL DEFAULT 0,
  p95_duration_ms BIGINT NOT NULL DEFAULT 0,
  p99_duration_ms BIGINT NOT NULL DEFAULT 0,
  execution_count INT NOT NULL DEFAULT 0,
  success_rate FLOAT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, pipeline_id, stage_name)
);
CREATE INDEX idx_pipeline_stage_baselines_tenant ON pipeline_stage_baselines(tenant_id);
CREATE INDEX idx_pipeline_stage_baselines_pipeline ON pipeline_stage_baselines(pipeline_id);

CREATE TABLE IF NOT EXISTS pipeline_auto_retries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  stage_name VARCHAR(200) NOT NULL,
  retry_attempt INT NOT NULL DEFAULT 1,
  retry_strategy VARCHAR(20) NOT NULL DEFAULT 'backoff',  -- immediate, backoff, skip
  previous_error TEXT,
  succeeded BOOLEAN NOT NULL DEFAULT false,
  duration_ms BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_auto_retries_tenant ON pipeline_auto_retries(tenant_id);
CREATE INDEX idx_pipeline_auto_retries_run ON pipeline_auto_retries(pipeline_run_id);
CREATE INDEX idx_pipeline_auto_retries_succeeded ON pipeline_auto_retries(succeeded);
CREATE INDEX idx_pipeline_auto_retries_created ON pipeline_auto_retries(created_at DESC);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- pipeline_error_classification
ALTER TABLE pipeline_error_classification ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_error_classification FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_pipeline_error_classification ON pipeline_error_classification
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_pipeline_error_classification_tenant_rls ON pipeline_error_classification(tenant_id);

COMMENT ON POLICY tenant_isolation_pipeline_error_classification ON pipeline_error_classification IS
    'Tenant isolation RLS policy - pipeline error classifications visible only to owning tenant';

-- pipeline_stage_baselines
ALTER TABLE pipeline_stage_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stage_baselines FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_pipeline_stage_baselines ON pipeline_stage_baselines
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_pipeline_stage_baselines_tenant_rls ON pipeline_stage_baselines(tenant_id);

COMMENT ON POLICY tenant_isolation_pipeline_stage_baselines ON pipeline_stage_baselines IS
    'Tenant isolation RLS policy - pipeline stage baselines visible only to owning tenant';

-- pipeline_auto_retries
ALTER TABLE pipeline_auto_retries ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_auto_retries FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_pipeline_auto_retries ON pipeline_auto_retries
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_pipeline_auto_retries_tenant_rls ON pipeline_auto_retries(tenant_id);

COMMENT ON POLICY tenant_isolation_pipeline_auto_retries ON pipeline_auto_retries IS
    'Tenant isolation RLS policy - pipeline auto retries visible only to owning tenant';
