-- Health-Check module tables (auto-generated)

CREATE TABLE IF NOT EXISTS health_checks (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(255) NOT NULL,
    check_type VARCHAR(255) NOT NULL,
    interval_sec BIGINT NOT NULL,
    enabled BOOLEAN NOT NULL,
    status VARCHAR(255) NOT NULL,
    last_result VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_health_checks_tenant ON health_checks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_created ON health_checks(created_at DESC);

