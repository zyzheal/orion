-- Alert-Breaker module tables (auto-generated)

CREATE TABLE IF NOT EXISTS alert_breakers (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    alert_id VARCHAR(255) NOT NULL,
    rule VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_alert_breakers_tenant ON alert_breakers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_breakers_created ON alert_breakers(created_at DESC);

