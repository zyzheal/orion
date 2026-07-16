-- Migration 284: ProviderCircuitBreaker Map() to PostgreSQL
-- Migrates states, metrics, requestHistory from in-memory Map storage

CREATE TABLE IF NOT EXISTS ai_provider_cb_states (
  id VARCHAR(100) PRIMARY KEY,
  provider_id VARCHAR(100) NOT NULL UNIQUE,
  state VARCHAR(20) NOT NULL DEFAULT 'CLOSED',
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_failure_time TIMESTAMP,
  last_success_time TIMESTAMP,
  last_state_change_time TIMESTAMP NOT NULL DEFAULT NOW(),
  half_open_probe_count INTEGER NOT NULL DEFAULT 0,
  open_start_time TIMESTAMP,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_cb_states_provider_id ON ai_provider_cb_states(provider_id);
CREATE INDEX IF NOT EXISTS idx_ai_provider_cb_states_state ON ai_provider_cb_states(state);
CREATE INDEX IF NOT EXISTS idx_ai_provider_cb_states_tenant ON ai_provider_cb_states(tenant_id);

CREATE TABLE IF NOT EXISTS ai_provider_cb_metrics (
  id VARCHAR(100) PRIMARY KEY,
  provider_id VARCHAR(100) NOT NULL UNIQUE,
  total_requests BIGINT NOT NULL DEFAULT 0,
  failed_requests BIGINT NOT NULL DEFAULT 0,
  success_requests BIGINT NOT NULL DEFAULT 0,
  failure_rate NUMERIC(8,6) NOT NULL DEFAULT 0,
  success_rate NUMERIC(8,6) NOT NULL DEFAULT 0,
  avg_latency NUMERIC(12,2) NOT NULL DEFAULT 0,
  p95_latency NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_failure_time TIMESTAMP,
  last_success_time TIMESTAMP,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_cb_metrics_provider_id ON ai_provider_cb_metrics(provider_id);
CREATE INDEX IF NOT EXISTS idx_ai_provider_cb_metrics_tenant ON ai_provider_cb_metrics(tenant_id);

CREATE TABLE IF NOT EXISTS ai_provider_cb_request_history (
  id VARCHAR(100) PRIMARY KEY,
  provider_id VARCHAR(100) NOT NULL,
  success BOOLEAN NOT NULL,
  latency INTEGER NOT NULL DEFAULT 0,
  request_time TIMESTAMP NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_cb_request_history_provider ON ai_provider_cb_request_history(provider_id, request_time DESC);
CREATE INDEX IF NOT EXISTS idx_ai_provider_cb_request_history_tenant ON ai_provider_cb_request_history(tenant_id);
