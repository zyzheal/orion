-- Migration: AI services Map() -> PostgreSQL persistence
-- Migrates MLInferenceService and DecisionExplanationService from in-memory Maps to PostgreSQL

-- ==================== ML Inference: Prediction History ====================
CREATE TABLE IF NOT EXISTS ai_prediction_history (
  id VARCHAR(100) PRIMARY KEY,
  model_id VARCHAR(100) NOT NULL,
  value_json JSONB NOT NULL,
  confidence NUMERIC(5,3) NOT NULL,
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  input_features JSONB NOT NULL DEFAULT '{}',
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_prediction_history_model ON ai_prediction_history(model_id, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_prediction_history_tenant ON ai_prediction_history(tenant_id);

-- ==================== ML Inference: Model Registry ====================
CREATE TABLE IF NOT EXISTS ai_model_registry (
  id VARCHAR(100) PRIMARY KEY,
  model_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  active_version VARCHAR(100),
  versions_json JSONB NOT NULL DEFAULT '[]',
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_model_registry_model ON ai_model_registry(model_id);

-- ==================== ML Inference: A/B Tests ====================
CREATE TABLE IF NOT EXISTS ai_ab_tests (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  model_id VARCHAR(100) NOT NULL,
  variant_a JSONB NOT NULL,
  variant_b JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  winner VARCHAR(100),
  metrics JSONB NOT NULL DEFAULT '{}',
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_ab_tests_model ON ai_ab_tests(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_ab_tests_status ON ai_ab_tests(status);

-- ==================== Decision Explanation History ====================
CREATE TABLE IF NOT EXISTS ai_decision_explanations (
  id VARCHAR(100) PRIMARY KEY,
  decision_id VARCHAR(100) NOT NULL UNIQUE,
  decision_type VARCHAR(100) NOT NULL,
  decision VARCHAR(50) NOT NULL,
  confidence NUMERIC(5,3) NOT NULL,
  confidence_level VARCHAR(50) NOT NULL,
  overall_reason TEXT,
  feature_importance JSONB NOT NULL DEFAULT '[]',
  matched_rules JSONB NOT NULL DEFAULT '[]',
  contributing_factors JSONB NOT NULL DEFAULT '[]',
  mitigating_factors JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',
  metadata_json JSONB,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_decision_expl_decision ON ai_decision_explanations(decision_id);
CREATE INDEX IF NOT EXISTS idx_ai_decision_expl_type ON ai_decision_explanations(decision_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_decision_expl_tenant ON ai_decision_explanations(tenant_id);
