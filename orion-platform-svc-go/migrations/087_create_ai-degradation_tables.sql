-- Ai-Degradation module tables (auto-generated)

CREATE TABLE IF NOT EXISTS degradation_configs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    strategy VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    triggers VARCHAR(255) NOT NULL,
    actions VARCHAR(255) NOT NULL,
    recovery VARCHAR(255) NOT NULL,
    metadata VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    last_triggered_at BIGINT,
    trigger_count BIGINT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_degradation_configs_tenant ON degradation_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_degradation_configs_created ON degradation_configs(created_at DESC);

CREATE TABLE IF NOT EXISTS degradation_histories (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    config_id VARCHAR(255) NOT NULL,
    triggered_at BIGINT NOT NULL,
    recovered_at BIGINT,
    trigger_type VARCHAR(255) NOT NULL,
    trigger_value DOUBLE PRECISION NOT NULL,
    trigger_threshold DOUBLE PRECISION NOT NULL,
    duration BIGINT NOT NULL,
    status VARCHAR(255) NOT NULL,
    actions VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_degradation_histories_tenant ON degradation_histories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_degradation_histories_created ON degradation_histories(created_at DESC);

