-- Circuit-Breaker module tables (full implementation)
-- State machine: CLOSED → OPEN → HALF_OPEN

DROP TABLE IF EXISTS circuit_breaker_events;
DROP TABLE IF EXISTS circuit_breakers;

CREATE TABLE IF NOT EXISTS circuit_breakers (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    service_name VARCHAR(255),
    failure_threshold INT NOT NULL DEFAULT 5,
    success_threshold INT NOT NULL DEFAULT 3,
    timeout_seconds INT NOT NULL DEFAULT 60,
    state VARCHAR(20) NOT NULL DEFAULT 'CLOSED',
    failure_count INT NOT NULL DEFAULT 0,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    last_state_change_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_circuit_breakers_tenant ON circuit_breakers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_circuit_breakers_state ON circuit_breakers(state);
CREATE INDEX IF NOT EXISTS idx_circuit_breakers_service ON circuit_breakers(service_name);
CREATE INDEX IF NOT EXISTS idx_circuit_breakers_created ON circuit_breakers(created_at DESC);

CREATE TABLE IF NOT EXISTS circuit_breaker_events (
    id VARCHAR(36) PRIMARY KEY,
    circuit_breaker_id VARCHAR(36) NOT NULL REFERENCES circuit_breakers(id) ON DELETE CASCADE,
    tenant_id VARCHAR(36) NOT NULL,
    previous_state VARCHAR(20),
    new_state VARCHAR(20) NOT NULL,
    reason VARCHAR(512),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cb_events_cb_id ON circuit_breaker_events(circuit_breaker_id);
CREATE INDEX IF NOT EXISTS idx_cb_events_tenant ON circuit_breaker_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cb_events_timestamp ON circuit_breaker_events(timestamp DESC);
