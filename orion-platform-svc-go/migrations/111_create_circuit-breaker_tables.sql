-- Circuit-Breaker module tables (auto-generated)

CREATE TABLE IF NOT EXISTS circuit_breakers (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_circuit_breakers_tenant ON circuit_breakers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_circuit_breakers_created ON circuit_breakers(created_at DESC);

