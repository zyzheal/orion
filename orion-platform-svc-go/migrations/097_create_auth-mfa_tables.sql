-- Auth-Mfa module tables (auto-generated)

CREATE TABLE IF NOT EXISTS m_f_a_devices (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    secret VARCHAR(255) NOT NULL,
    digits BIGINT NOT NULL,
    period BIGINT NOT NULL,
    issuer VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_m_f_a_devices_tenant ON m_f_a_devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_m_f_a_devices_created ON m_f_a_devices(created_at DESC);

