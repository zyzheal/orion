-- 001_create_api_consumption_tables.sql
CREATE TABLE IF NOT EXISTS api_consumptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    api_key_id UUID NOT NULL,
    endpoint_path VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    request_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    bytes_transferred BIGINT DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    api_key_id UUID NOT NULL,
    endpoint_path VARCHAR(500),
    method VARCHAR(10),
    limit_count INT NOT NULL,
    period VARCHAR(20) NOT NULL, -- daily, monthly, yearly
    limit_amount BIGINT,
    limit_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_consumptions_tenant ON api_consumptions(tenant_id);
CREATE INDEX idx_api_consumptions_date ON api_consumptions(date);
CREATE INDEX idx_usage_limits_tenant ON usage_limits(tenant_id);