-- Digital-Twin-Simulation module tables (auto-generated)

CREATE TABLE IF NOT EXISTS digital_twins (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    entity_type VARCHAR(255) NOT NULL,
    source_id VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    config VARCHAR(255) NOT NULL,
    metadata VARCHAR(255) NOT NULL,
    sync_policy VARCHAR(255) NOT NULL,
    last_sync_time BIGINT,
    sync_health VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_digital_twins_tenant ON digital_twins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_digital_twins_created ON digital_twins(created_at DESC);

CREATE TABLE IF NOT EXISTS simulations (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    twin_id VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    parameters VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    start_time BIGINT NOT NULL,
    end_time BIGINT,
    duration BIGINT,
    results VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_simulations_tenant ON simulations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_simulations_created ON simulations(created_at DESC);

