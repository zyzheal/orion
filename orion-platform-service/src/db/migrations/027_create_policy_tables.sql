-- Migration 027: OPA Policy Engine
-- Creates tables for policy definitions, bundles, evaluations, violations, and overrides

-- 策略定义
CREATE TABLE IF NOT EXISTS policy_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL UNIQUE,
  description     TEXT,
  category        VARCHAR(50) NOT NULL,           -- security | cost | quality | governance
  rego_path       VARCHAR(255) NOT NULL,           -- Path in policy repo
  gate_id         VARCHAR(50),                     -- Pipeline gate identifier
  severity        VARCHAR(20) NOT NULL DEFAULT 'warning', -- block | warning | info
  enabled         BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB DEFAULT '{}',              -- Tags, owners, SLA
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_policy_definitions_category ON policy_definitions(category);

-- 策略包 (从 Git 同步的 bundle)
CREATE TABLE IF NOT EXISTS policy_bundles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_name     VARCHAR(100) NOT NULL,
  git_ref         VARCHAR(100) NOT NULL,            -- branch/tag/commit
  rego_content    JSONB NOT NULL,                   -- {file_path: rego_source}
  test_results    JSONB,                            -- Test run results
  deployed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deployed_by     UUID,
  status          VARCHAR(20) NOT NULL DEFAULT 'active' -- active | deprecated | failed
);
CREATE INDEX idx_policy_bundles_name ON policy_bundles(bundle_name);

-- 策略评估日志
CREATE TABLE IF NOT EXISTS policy_evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       UUID REFERENCES policy_definitions(id),
  run_id          UUID NOT NULL,                     -- Pipeline run ID
  input_context   JSONB NOT NULL,                    -- Evaluation input
  result          JSONB NOT NULL,                    -- Allow/deny + reasons
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  evaluation_ms   INT                                -- Evaluation duration
);
CREATE INDEX idx_policy_evaluations_run ON policy_evaluations(run_id);
CREATE INDEX idx_policy_evaluations_policy ON policy_evaluations(policy_id);

-- 违规记录
CREATE TABLE IF NOT EXISTS policy_violations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id   UUID REFERENCES policy_evaluations(id),
  policy_id       UUID REFERENCES policy_definitions(id),
  severity        VARCHAR(20) NOT NULL,
  message         TEXT NOT NULL,
  resource_type   VARCHAR(50),                       -- pipeline | deployment | image | config
  resource_id     VARCHAR(255),
  status          VARCHAR(20) NOT NULL DEFAULT 'open', -- open | waived | resolved
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_policy_violations_status ON policy_violations(status);
CREATE INDEX idx_policy_violations_policy ON policy_violations(policy_id);

-- 策略豁免
CREATE TABLE IF NOT EXISTS policy_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       UUID REFERENCES policy_definitions(id),
  violation_id    UUID REFERENCES policy_violations(id),
  reason          TEXT NOT NULL,
  approved_by     UUID,
  approved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  scope           VARCHAR(50) DEFAULT 'global'       -- global | project | environment
);
CREATE INDEX idx_policy_overrides_policy ON policy_overrides(policy_id);
