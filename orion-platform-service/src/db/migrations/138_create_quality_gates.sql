-- Migration 138: Quality Gates (Code Quality Gates with Blocking)
-- GAP-CN-04: 代码质量门禁机制
-- Tables: quality_gates (definitions), quality_gate_results (evaluations)

CREATE TABLE IF NOT EXISTS quality_gates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         VARCHAR(100) NOT NULL,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  rules             JSONB NOT NULL DEFAULT '[]',
  external_provider JSONB,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quality_gates_tenant ON quality_gates(tenant_id);
CREATE INDEX idx_quality_gates_tenant_name ON quality_gates(tenant_id, name);
CREATE INDEX idx_quality_gates_enabled ON quality_gates(enabled);

CREATE TABLE IF NOT EXISTS quality_gate_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_id       VARCHAR(200) NOT NULL,
  gate_name     VARCHAR(200) NOT NULL,
  run_id        VARCHAR(200) NOT NULL,
  stage_name    VARCHAR(200) NOT NULL,
  metrics       JSONB NOT NULL DEFAULT '{}',
  passed        BOOLEAN NOT NULL DEFAULT false,
  blocked_rules JSONB NOT NULL DEFAULT '[]',
  warned_rules  JSONB NOT NULL DEFAULT '[]',
  evaluated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quality_gate_results_run ON quality_gate_results(run_id);
CREATE INDEX idx_quality_gate_results_stage ON quality_gate_results(run_id, stage_name);
CREATE INDEX idx_quality_gate_results_passed ON quality_gate_results(passed);

-- Rollback:
-- DROP TABLE IF EXISTS quality_gate_results;
-- DROP TABLE IF EXISTS quality_gates;
