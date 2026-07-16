-- Migration 147: Chaos Engineering Experiments and Runs
--
-- Support for chaos experiment lifecycle management:
-- - chaos_experiments: Experiment definitions with faults, scope, steady-state hypothesis
-- - chaos_runs: Individual experiment execution records with results and events

CREATE TABLE IF NOT EXISTS chaos_experiments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  name                    VARCHAR(200) NOT NULL,
  description             TEXT,
  status                  VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, active, paused, completed, failed
  service_id              VARCHAR(200),                         -- Target service identifier
  environment             VARCHAR(50) NOT NULL DEFAULT 'staging', -- Target environment
  scope                   JSONB NOT NULL DEFAULT '{}',           -- {tenant_id, service_id, environment, namespace}
  faults                  JSONB NOT NULL DEFAULT '[]',           -- Array of fault definitions
  steady_state_hypothesis JSONB,                                 -- Expected system behavior during experiment
  auto_rollback           BOOLEAN NOT NULL DEFAULT true,         -- Automatic rollback on failure
  created_by              VARCHAR(100),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chaos_experiments_tenant ON chaos_experiments(tenant_id);
CREATE INDEX idx_chaos_experiments_status ON chaos_experiments(status);
CREATE INDEX idx_chaos_experiments_service ON chaos_experiments(service_id);
CREATE INDEX idx_chaos_experiments_environment ON chaos_experiments(environment);
CREATE UNIQUE INDEX idx_chaos_experiments_tenant_name ON chaos_experiments(tenant_id, name);

CREATE TABLE IF NOT EXISTS chaos_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES chaos_experiments(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, dry_run, rolled_back
  dry_run       BOOLEAN NOT NULL DEFAULT false,
  result        JSONB,                                    -- Final result summary
  events        JSONB NOT NULL DEFAULT '[]',              -- Timeline of events during execution
  error_message TEXT,
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chaos_runs_experiment ON chaos_runs(experiment_id);
CREATE INDEX idx_chaos_runs_tenant ON chaos_runs(tenant_id);
CREATE INDEX idx_chaos_runs_status ON chaos_runs(status);
CREATE INDEX idx_chaos_runs_created ON chaos_runs(created_at DESC);

-- Rollback:
-- DROP TABLE IF EXISTS chaos_runs;
-- DROP TABLE IF EXISTS chaos_experiments;
