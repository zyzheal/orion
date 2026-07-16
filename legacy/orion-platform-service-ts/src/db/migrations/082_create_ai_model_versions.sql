-- Migration 082: AI Model Versions (Phase 2)
-- 模型版本管理和决策解释

CREATE TABLE IF NOT EXISTS ai_model_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  model_type       VARCHAR(50) NOT NULL,
  version         VARCHAR(20) NOT NULL,
  status          VARCHAR(20) DEFAULT 'registered',
  features        TEXT[] NOT NULL,
  metrics         JSONB DEFAULT '{"accuracy": 0, "precision": 0, "recall": 0, "f1Score": 0}',
  training_info   JSONB DEFAULT '{}',
  ab_test_config  JSONB DEFAULT '{}',
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, version)
);

CREATE INDEX idx_ai_model_versions_type ON ai_model_versions(model_type);
CREATE INDEX idx_ai_model_versions_status ON ai_model_versions(status);
CREATE INDEX idx_ai_model_versions_active ON ai_model_versions(status) WHERE status = 'active';

-- Decision Feedback
CREATE TABLE IF NOT EXISTS ai_decision_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision_id     UUID NOT NULL,
  scenario        VARCHAR(100) NOT NULL,
  model_id        UUID REFERENCES ai_model_versions(id),
  rating          VARCHAR(20) NOT NULL,
  comment         TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_decision_feedback_decision ON ai_decision_feedback(decision_id);
CREATE INDEX idx_ai_decision_feedback_scenario ON ai_decision_feedback(scenario);
CREATE INDEX idx_ai_decision_feedback_created ON ai_decision_feedback(created_at DESC);

-- Degradation Configs (动态配置)
CREATE TABLE IF NOT EXISTS degradation_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  scenario        VARCHAR(100) NOT NULL UNIQUE,
  strategy        VARCHAR(50) NOT NULL DEFAULT 'rule-engine',
  fallback_strategies TEXT[] NOT NULL DEFAULT '{}',
  rule_set        JSONB DEFAULT '{}',
  template_name   VARCHAR(100),
  cache_ttl       INT DEFAULT 300,
  notify_on_degradation BOOLEAN DEFAULT true,
  default_response JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_degradation_configs_scenario ON degradation_configs(scenario);
