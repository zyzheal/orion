-- Migration 255: Efficiency Scenarios Persistence
-- Stores efficiency dashboard scenarios in PostgreSQL instead of in-memory Map()
-- in EfficiencyDashboardService.scenarioCache

CREATE TABLE IF NOT EXISTS efficiency_scenarios (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  scenario_id VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category VARCHAR(64) NOT NULL DEFAULT 'overview',
  widgets JSONB NOT NULL DEFAULT '[]',
  time_range JSONB NOT NULL DEFAULT '{}',
  summary JSONB NOT NULL DEFAULT '{}',
  cache_key VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_efficiency_scenarios_tenant_id ON efficiency_scenarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_efficiency_scenarios_cache_key ON efficiency_scenarios(cache_key);
CREATE INDEX IF NOT EXISTS idx_efficiency_scenarios_expires_at ON efficiency_scenarios(expires_at);
