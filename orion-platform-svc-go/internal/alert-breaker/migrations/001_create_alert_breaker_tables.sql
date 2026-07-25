-- Migration: 001_create_alert_breaker_tables
-- Create circuit breaker tables for alert circuit breaker (N-22 / F-10).

CREATE TABLE IF NOT EXISTS circuit_breaker_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    strategy        TEXT NOT NULL DEFAULT 'threshold',  -- threshold, consecutive_failures, rate
    threshold       INT NOT NULL DEFAULT 5,             -- Trigger threshold
    window          INT NOT NULL DEFAULT 60,            -- Time window in seconds
    min_requests    INT NOT NULL DEFAULT 10,            -- Minimum requests before evaluating
    failure_rate    DOUBLE PRECISION NOT NULL DEFAULT 0.5, -- Failure rate threshold (0-1)
    open_timeout    INT NOT NULL DEFAULT 30,            -- Seconds to stay open before half-open
    half_open_max   INT NOT NULL DEFAULT 3,             -- Max requests in half-open state
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    status          TEXT NOT NULL DEFAULT 'active',     -- active, disabled
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_circuit_breaker_configs_tenant ON circuit_breaker_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_configs_status ON circuit_breaker_configs(status);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_configs_enabled ON circuit_breaker_configs(enabled);

CREATE TABLE IF NOT EXISTS circuit_breaker_states (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id       UUID NOT NULL REFERENCES circuit_breaker_configs(id) ON DELETE CASCADE,
    state           TEXT NOT NULL DEFAULT 'closed',      -- closed, open, half_open, forced_open, forced_closed
    failure_count   INT NOT NULL DEFAULT 0,
    success_count   INT NOT NULL DEFAULT 0,
    last_failure    TIMESTAMPTZ,
    last_success    TIMESTAMPTZ,
    transitioned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    error           TEXT DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_circuit_breaker_states_config ON circuit_breaker_states(config_id);

CREATE TABLE IF NOT EXISTS circuit_breaker_events (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES circuit_breaker_configs(id) ON DELETE CASCADE,
    action    TEXT NOT NULL,  -- request, success, failure, state_change
    details   TEXT DEFAULT '', -- JSON
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_circuit_breaker_events_config ON circuit_breaker_events(config_id);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_events_action ON circuit_breaker_events(action);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_events_created ON circuit_breaker_events(created_at DESC);
