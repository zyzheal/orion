-- Chaos-Gateway module tables (auto-generated)

CREATE TABLE IF NOT EXISTS experiment_results (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    experiment_id VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    start_time BIGINT,
    end_time BIGINT,
    duration BIGINT NOT NULL,
    metrics VARCHAR(255) NOT NULL,
    impacted_targets VARCHAR(255) NOT NULL,
    recovery_time BIGINT NOT NULL,
    detection_time BIGINT NOT NULL,
    insights VARCHAR(255) NOT NULL,
    recommendations VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_experiment_results_tenant ON experiment_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_experiment_results_created ON experiment_results(created_at DESC);

CREATE TABLE IF NOT EXISTS experiment_logs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    experiment_id VARCHAR(255) NOT NULL,
    timestamp BIGINT NOT NULL,
    level VARCHAR(255) NOT NULL,
    message VARCHAR(255) NOT NULL,
    details VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_experiment_logs_tenant ON experiment_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_experiment_logs_created ON experiment_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS chaos_experiments (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    scenario VARCHAR(255) NOT NULL,
    targets VARCHAR(255) NOT NULL,
    duration BIGINT NOT NULL,
    intensity BIGINT NOT NULL,
    schedule VARCHAR(255) NOT NULL,
    monitoring VARCHAR(255) NOT NULL,
    safeguards VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    started_at BIGINT,
    completed_at BIGINT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_chaos_experiments_tenant ON chaos_experiments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chaos_experiments_created ON chaos_experiments(created_at DESC);

