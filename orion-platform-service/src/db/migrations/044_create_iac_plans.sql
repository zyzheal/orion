-- Migration 044: IaC Drift Detection

CREATE TABLE IF NOT EXISTS iac_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  terraform_version VARCHAR(50),
  plan_content    JSONB NOT NULL,
  resources_to_add INT NOT NULL DEFAULT 0,
  resources_to_change INT NOT NULL DEFAULT 0,
  resources_to_destroy INT NOT NULL DEFAULT 0,
  applied         BOOLEAN NOT NULL DEFAULT false,
  applied_at      TIMESTAMPTZ,
  applied_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_iac_plans_applied ON iac_plans(applied);

CREATE TABLE IF NOT EXISTS iac_drift_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type   VARCHAR(100) NOT NULL,
  resource_id     VARCHAR(500) NOT NULL,
  expected_state  JSONB NOT NULL,
  actual_state    JSONB NOT NULL,
  drift_detected  BOOLEAN NOT NULL DEFAULT false,
  changed_fields  TEXT[] NOT NULL DEFAULT '{}',
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_iac_drift_resource ON iac_drift_results(resource_type, resource_id);
CREATE INDEX idx_iac_drift_detected ON iac_drift_results(drift_detected);

-- Rollback:
-- DROP TABLE IF EXISTS iac_drift_results, iac_plans;
