-- Migration 216: AIGateway Map() to PostgreSQL
-- Migrates metrics, circuitStates, requestHistory from in-memory Map storage

CREATE TABLE IF NOT EXISTS ai_gateway_metrics (
  id VARCHAR(100) PRIMARY KEY,
  scenario VARCHAR(100) NOT NULL UNIQUE,
  total_requests BIGINT NOT NULL DEFAULT 0,
  failed_requests BIGINT NOT NULL DEFAULT 0,
  total_latency BIGINT NOT NULL DEFAULT 0,
  avg_latency NUMERIC(12,2) NOT NULL DEFAULT 0,
  p95_latency NUMERIC(12,2) NOT NULL DEFAULT 0,
  error_rate NUMERIC(8,6) NOT NULL DEFAULT 0,
  last_error TEXT,
  last_error_time TIMESTAMP,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_gateway_metrics_scenario ON ai_gateway_metrics(scenario);
CREATE INDEX IF NOT EXISTS idx_ai_gateway_metrics_tenant ON ai_gateway_metrics(tenant_id);

CREATE TABLE IF NOT EXISTS ai_gateway_circuit_states (
  id VARCHAR(100) PRIMARY KEY,
  scenario VARCHAR(100) NOT NULL UNIQUE,
  state VARCHAR(20) NOT NULL DEFAULT 'CLOSED',
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_failure_time TIMESTAMP,
  last_state_change_time TIMESTAMP NOT NULL DEFAULT NOW(),
  half_open_attempts INTEGER NOT NULL DEFAULT 0,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_gateway_circuit_states_scenario ON ai_gateway_circuit_states(scenario);
CREATE INDEX IF NOT EXISTS idx_ai_gateway_circuit_states_state ON ai_gateway_circuit_states(state);
CREATE INDEX IF NOT EXISTS idx_ai_gateway_circuit_states_tenant ON ai_gateway_circuit_states(tenant_id);

CREATE TABLE IF NOT EXISTS ai_gateway_request_history (
  id VARCHAR(100) PRIMARY KEY,
  scenario VARCHAR(100) NOT NULL,
  latency INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  request_time TIMESTAMP NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_gateway_request_history_scenario ON ai_gateway_request_history(scenario, request_time DESC);
CREATE INDEX IF NOT EXISTS idx_ai_gateway_request_history_tenant ON ai_gateway_request_history(tenant_id);
