-- Migration 283: CircuitBreakerManager Map() to PostgreSQL
-- Migrates scenarioStates and providerMap from in-memory Map storage

CREATE TABLE IF NOT EXISTS ai_cb_manager_scenario_states (
  id VARCHAR(100) PRIMARY KEY,
  scenario VARCHAR(100) NOT NULL UNIQUE,
  state VARCHAR(20) NOT NULL DEFAULT 'CLOSED',
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_failure_time TIMESTAMP,
  last_state_change_time TIMESTAMP NOT NULL DEFAULT NOW(),
  half_open_attempts INTEGER NOT NULL DEFAULT 0,
  tenant_id VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_cb_manager_scenario_states_scenario ON ai_cb_manager_scenario_states(scenario);
CREATE INDEX IF NOT EXISTS idx_ai_cb_manager_scenario_states_state ON ai_cb_manager_scenario_states(state);
CREATE INDEX IF NOT EXISTS idx_ai_cb_manager_scenario_states_tenant ON ai_cb_manager_scenario_states(tenant_id);

CREATE TABLE IF NOT EXISTS ai_cb_manager_providers (
  id VARCHAR(100) PRIMARY KEY,
  provider_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config_json JSONB DEFAULT '{}',
  tenant_id VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_cb_manager_providers_provider_id ON ai_cb_manager_providers(provider_id);
CREATE INDEX IF NOT EXISTS idx_ai_cb_manager_providers_enabled ON ai_cb_manager_providers(enabled);
CREATE INDEX IF NOT EXISTS idx_ai_cb_manager_providers_tenant ON ai_cb_manager_providers(tenant_id);
