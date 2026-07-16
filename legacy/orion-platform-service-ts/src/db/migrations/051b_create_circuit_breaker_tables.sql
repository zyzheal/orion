-- Migration: 051_create_circuit_breaker_tables.sql
-- Purpose: Create tables for circuit breaker configuration and event logging
-- Feature: F001 - Circuit Breaker Service Layer

-- Circuit breaker configurations
CREATE TABLE IF NOT EXISTS circuit_breaker_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_key VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    failure_threshold INT NOT NULL DEFAULT 5,
    recovery_timeout_ms INT NOT NULL DEFAULT 60000,
    success_threshold INT NOT NULL DEFAULT 1,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN circuit_breaker_configs.target_key IS 'Unique identifier for the target dependency (e.g., scm:github, registry:docker)';
COMMENT ON COLUMN circuit_breaker_configs.failure_threshold IS 'Number of consecutive failures before opening circuit';
COMMENT ON COLUMN circuit_breaker_configs.recovery_timeout_ms IS 'Milliseconds to wait before transitioning from OPEN to HALF_OPEN';
COMMENT ON COLUMN circuit_breaker_configs.success_threshold IS 'Number of consecutive successes in HALF_OPEN to close circuit';

-- Circuit breaker state snapshots (latest state per target_key)
CREATE TABLE IF NOT EXISTS circuit_breaker_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_key VARCHAR(255) NOT NULL UNIQUE,
    state VARCHAR(20) NOT NULL DEFAULT 'closed',
    failure_count INT NOT NULL DEFAULT 0,
    success_count INT NOT NULL DEFAULT 0,
    last_failure_time TIMESTAMPTZ,
    last_success_time TIMESTAMPTZ,
    last_state_change TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN circuit_breaker_states.state IS 'Current circuit state: closed, open, half-open';

-- Circuit breaker event log
CREATE TABLE IF NOT EXISTS circuit_breaker_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_key VARCHAR(255) NOT NULL,
    event_type VARCHAR(20) NOT NULL,
    from_state VARCHAR(20),
    to_state VARCHAR(20),
    failure_count INT,
    success_count INT,
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN circuit_breaker_events.event_type IS 'Event type: state_change, failure, success, manual_trip, manual_reset, config_change';

-- Indexes for efficient queries
CREATE INDEX idx_cb_events_target ON circuit_breaker_events (target_key, created_at DESC);
CREATE INDEX idx_cb_events_type ON circuit_breaker_events (event_type, created_at DESC);
CREATE INDEX idx_cb_states_state ON circuit_breaker_states (state);
CREATE INDEX idx_cb_configs_enabled ON circuit_breaker_configs (enabled);
