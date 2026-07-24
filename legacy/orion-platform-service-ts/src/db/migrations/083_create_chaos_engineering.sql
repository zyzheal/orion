-- Migration 083: Chaos Engineering (Phase 3)
-- 混沌工程和韧性评分

CREATE TABLE IF NOT EXISTS chaos_experiments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  name                  VARCHAR(200) NOT NULL,
  description           TEXT,
  scope                 JSONB NOT NULL,
  faults                JSONB NOT NULL,
  steady_state_hypothesis TEXT,
  auto_rollback         BOOLEAN DEFAULT true,
  status                VARCHAR(20) DEFAULT 'draft',
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chaos_experiments_tenant ON chaos_experiments(tenant_id);
CREATE INDEX idx_chaos_experiments_status ON chaos_experiments(status);

CREATE TABLE IF NOT EXISTS chaos_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id         UUID NOT NULL REFERENCES chaos_experiments(id) ON DELETE CASCADE,
  status                VARCHAR(20) DEFAULT 'running',
  timeline              JSONB DEFAULT '[]',
  metrics               JSONB NOT NULL DEFAULT '{}',
  started_at            TIMESTAMPTZ DEFAULT now(),
  ended_at              TIMESTAMPTZ
);

CREATE INDEX idx_chaos_runs_experiment ON chaos_runs(experiment_id, started_at DESC);
CREATE INDEX idx_chaos_runs_status ON chaos_runs(status);

CREATE TABLE IF NOT EXISTS resilience_scores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  service_id            UUID,
  score                 INT NOT NULL CHECK (score >= 0 AND score <= 100),
  mttr_ms               INT,
  success_rate          DECIMAL(5,4),
  error_budget          DECIMAL(5,4),
  trend                 VARCHAR(20),
  calculated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_resilience_scores_tenant ON resilience_scores(tenant_id, calculated_at DESC);
CREATE INDEX idx_resilience_scores_service ON resilience_scores(service_id);
