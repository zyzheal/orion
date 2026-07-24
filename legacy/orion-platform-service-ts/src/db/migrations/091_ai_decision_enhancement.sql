-- 091: AI Decision Enhancement
-- AI 决策解释、模型版本管理、A/B 测试

CREATE TABLE IF NOT EXISTS ai_decision_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision_id VARCHAR(100) NOT NULL,
  decision_type VARCHAR(50) NOT NULL,  -- deployment_approval, risk_assessment, etc
  explanation JSONB NOT NULL DEFAULT '{}',
  feature_importance JSONB NOT NULL DEFAULT '[]',
  confidence_score FLOAT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_decision_explanations_tenant ON ai_decision_explanations(tenant_id);
CREATE INDEX idx_ai_decision_explanations_decision ON ai_decision_explanations(decision_id);
CREATE INDEX idx_ai_decision_explanations_type ON ai_decision_explanations(decision_type);
CREATE INDEX idx_ai_decision_explanations_created ON ai_decision_explanations(created_at DESC);

CREATE TABLE IF NOT EXISTS ai_model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  model_name VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL,
  model_type VARCHAR(50) NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}',
  metrics JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_deprecated BOOLEAN NOT NULL DEFAULT false,
  training_data_summary JSONB NOT NULL DEFAULT '{}',
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, model_name, version)
);
CREATE INDEX idx_ai_model_versions_tenant ON ai_model_versions(tenant_id);
CREATE INDEX idx_ai_model_versions_model ON ai_model_versions(model_name);
CREATE INDEX idx_ai_model_versions_active ON ai_model_versions(tenant_id, model_name) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS ai_ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  model_name VARCHAR(100) NOT NULL,
  variant_a_id UUID REFERENCES ai_model_versions(id),
  variant_b_id UUID REFERENCES ai_model_versions(id),
  result JSONB NOT NULL DEFAULT '{}',
  winner VARCHAR(10),  -- 'A', 'B', 'tie'
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_ai_ab_test_results_tenant ON ai_ab_test_results(tenant_id);
CREATE INDEX idx_ai_ab_test_results_model ON ai_ab_test_results(model_name);
CREATE INDEX idx_ai_ab_test_results_started ON ai_ab_test_results(started_at DESC);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- ai_decision_explanations
ALTER TABLE ai_decision_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_decision_explanations FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_ai_decision_explanations ON ai_decision_explanations
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_ai_decision_explanations_tenant_rls ON ai_decision_explanations(tenant_id);

COMMENT ON POLICY tenant_isolation_ai_decision_explanations ON ai_decision_explanations IS
    'Tenant isolation RLS policy - AI decision explanations visible only to owning tenant';

-- ai_model_versions
ALTER TABLE ai_model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_ai_model_versions ON ai_model_versions
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_ai_model_versions_tenant_rls ON ai_model_versions(tenant_id);

COMMENT ON POLICY tenant_isolation_ai_model_versions ON ai_model_versions IS
    'Tenant isolation RLS policy - AI model versions visible only to owning tenant';

-- ai_ab_test_results
ALTER TABLE ai_ab_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ab_test_results FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_ai_ab_test_results ON ai_ab_test_results
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_ai_ab_test_results_tenant_rls ON ai_ab_test_results(tenant_id);

COMMENT ON POLICY tenant_isolation_ai_ab_test_results ON ai_ab_test_results IS
    'Tenant isolation RLS policy - AI A/B test results visible only to owning tenant';
