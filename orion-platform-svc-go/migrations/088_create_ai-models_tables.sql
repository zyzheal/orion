-- Ai-Models module tables (auto-generated)

CREATE TABLE IF NOT EXISTS a_i_models (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    framework VARCHAR(255) NOT NULL,
    current_version VARCHAR(255),
    tags VARCHAR(255) NOT NULL,
    metadata VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_a_i_models_tenant ON a_i_models(tenant_id);
CREATE INDEX IF NOT EXISTS idx_a_i_models_created ON a_i_models(created_at DESC);

CREATE TABLE IF NOT EXISTS model_versions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    version VARCHAR(255) NOT NULL,
    artifact_uri VARCHAR(255) NOT NULL,
    environment VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    metrics VARCHAR(255) NOT NULL,
    config VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    promoted_at BIGINT,
    promoted_by VARCHAR(255),
    deprecated_at BIGINT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_model_versions_tenant ON model_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_model_versions_created ON model_versions(created_at DESC);

CREATE TABLE IF NOT EXISTS canary_configs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    target_version VARCHAR(255) NOT NULL,
    traffic_percent DOUBLE PRECISION NOT NULL,
    success_threshold DOUBLE PRECISION NOT NULL,
    latency_threshold DOUBLE PRECISION NOT NULL,
    error_rate_threshold DOUBLE PRECISION NOT NULL,
    start_time BIGINT NOT NULL,
    duration BIGINT NOT NULL,
    status VARCHAR(255) NOT NULL,
    current_metrics VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_canary_configs_tenant ON canary_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_canary_configs_created ON canary_configs(created_at DESC);

