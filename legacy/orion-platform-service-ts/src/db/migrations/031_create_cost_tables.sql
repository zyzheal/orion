-- Migration 031: AI Cost Optimization
-- 创建 AI 成本优化相关表：预算、成本记录、告警规则、模型定价

-- 预算表
CREATE TABLE IF NOT EXISTS budgets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  type          VARCHAR(20) NOT NULL,              -- tenant | project | user
  scope         VARCHAR(255) NOT NULL,              -- tenant_id / project_id / user_id
  period        VARCHAR(20) NOT NULL,               -- daily | weekly | monthly | quarterly | yearly
  amount        DECIMAL(12, 2) NOT NULL,            -- 预算金额
  thresholds    JSONB NOT NULL DEFAULT '{"warning": 0.8, "critical": 0.95, "hard_limit": 1.0}',
  status        VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | paused | exhausted | deleted
  spent         DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_budgets_type_scope ON budgets(type, scope);
CREATE INDEX idx_budgets_status ON budgets(status);

-- 成本记录表
CREATE TABLE IF NOT EXISTS cost_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    VARCHAR(255) NOT NULL,
  model         VARCHAR(100) NOT NULL,
  provider      VARCHAR(100) NOT NULL,
  input_tokens  BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  input_cost    DECIMAL(10, 6) NOT NULL DEFAULT 0,
  output_cost   DECIMAL(10, 6) NOT NULL DEFAULT 0,
  total_cost    DECIMAL(10, 6) NOT NULL DEFAULT 0,
  tenant_id     UUID,
  project_id    UUID,
  user_id       UUID,
  module_type   VARCHAR(100) NOT NULL,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_records_tenant ON cost_records(tenant_id);
CREATE INDEX idx_cost_records_project ON cost_records(project_id);
CREATE INDEX idx_cost_records_user ON cost_records(user_id);
CREATE INDEX idx_cost_records_timestamp ON cost_records(timestamp);
CREATE INDEX idx_cost_records_model ON cost_records(model, provider);

-- 告警规则表
CREATE TABLE IF NOT EXISTS alert_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  budget_id     UUID REFERENCES budgets(id) ON DELETE SET NULL,
  condition     VARCHAR(30) NOT NULL,               -- budget_percentage | absolute_cost | rate_of_change
  threshold     DECIMAL(10, 4) NOT NULL,
  severity      VARCHAR(20) NOT NULL DEFAULT 'warning',  -- info | warning | critical
  recipients    TEXT[] NOT NULL DEFAULT '{}',
  status        VARCHAR(20) NOT NULL DEFAULT 'active',   -- active | resolved | acknowledged
  last_triggered TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_rules_budget ON alert_rules(budget_id);
CREATE INDEX idx_alert_rules_status ON alert_rules(status);
CREATE INDEX idx_alert_rules_severity ON alert_rules(severity);

-- 模型定价表
CREATE TABLE IF NOT EXISTS model_pricing (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          VARCHAR(100) NOT NULL,
  model             VARCHAR(100) NOT NULL,
  input_price_per_1k DECIMAL(10, 6) NOT NULL,
  output_price_per_1k DECIMAL(10, 6) NOT NULL,
  currency          VARCHAR(10) NOT NULL DEFAULT 'CNY',
  effective_from    TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to      TIMESTAMPTZ,
  notes             TEXT,
  UNIQUE (provider, model, effective_from)
);

CREATE INDEX idx_model_pricing_provider ON model_pricing(provider);
CREATE INDEX idx_model_pricing_active ON model_pricing(provider, model) WHERE effective_to IS NULL;
