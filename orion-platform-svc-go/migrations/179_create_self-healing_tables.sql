-- Self-Healing module tables (auto-generated)

CREATE TABLE IF NOT EXISTS healing_incidents (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    alert_id VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    severity VARCHAR(255) NOT NULL,
    app_name VARCHAR(255) NOT NULL,
    environment VARCHAR(255) NOT NULL,
    strategy_id VARCHAR(255) NOT NULL,
    strategy_name VARCHAR(255) NOT NULL,
    actions VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    attempts BIGINT NOT NULL,
    approval_status VARCHAR(255) NOT NULL,
    approval_request_id VARCHAR(255) NOT NULL,
    result VARCHAR(255) NOT NULL,
    error VARCHAR(255) NOT NULL,
    tags VARCHAR(255) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_healing_incidents_tenant ON healing_incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_healing_incidents_created ON healing_incidents(created_at DESC);

