-- MLOps dedicated tables: models, experiments, artifacts, pipelines, training jobs, deployments, metrics
-- Migration 375 — replaces generic 'records' table with domain-specific schema

CREATE TABLE IF NOT EXISTS mlops_models (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    framework VARCHAR(50) NOT NULL DEFAULT 'unknown',
    version VARCHAR(50) NOT NULL DEFAULT 'v1.0.0',
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    artifact_path TEXT,
    metrics JSONB DEFAULT '{}'::JSONB,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mlops_models_tenant ON mlops_models(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mlops_models_status ON mlops_models(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_mlops_models_name ON mlops_models(tenant_id, name);

CREATE TABLE IF NOT EXISTS mlops_experiments (
    id VARCHAR(36) PRIMARY KEY,
    model_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'running',
    config JSONB DEFAULT '{}'::JSONB,
    results JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_experiments_model FOREIGN KEY (model_id) REFERENCES mlops_models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mlops_experiments_model ON mlops_experiments(model_id);
CREATE INDEX IF NOT EXISTS idx_mlops_experiments_tenant ON mlops_experiments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mlops_experiments_status ON mlops_experiments(tenant_id, status);

CREATE TABLE IF NOT EXISTS mlops_artifacts (
    id VARCHAR(36) PRIMARY KEY,
    model_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'checkpoint',
    storage_path TEXT NOT NULL,
    size_bytes BIGINT DEFAULT 0,
    checksum VARCHAR(64),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_artifacts_model FOREIGN KEY (model_id) REFERENCES mlops_models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mlops_artifacts_model ON mlops_artifacts(model_id);
CREATE INDEX IF NOT EXISTS idx_mlops_artifacts_tenant ON mlops_artifacts(tenant_id);

CREATE TABLE IF NOT EXISTS mlops_pipelines (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'idle',
    config JSONB DEFAULT '{}'::JSONB,
    last_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mlops_pipelines_tenant ON mlops_pipelines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mlops_pipelines_status ON mlops_pipelines(tenant_id, status);

CREATE TABLE IF NOT EXISTS mlops_training_jobs (
    id VARCHAR(36) PRIMARY KEY,
    model_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    config JSONB DEFAULT '{}'::JSONB,
    metrics JSONB DEFAULT '{}'::JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_training_jobs_model FOREIGN KEY (model_id) REFERENCES mlops_models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mlops_training_jobs_model ON mlops_training_jobs(model_id);
CREATE INDEX IF NOT EXISTS idx_mlops_training_jobs_tenant ON mlops_training_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mlops_training_jobs_status ON mlops_training_jobs(tenant_id, status);

CREATE TABLE IF NOT EXISTS mlops_deployments (
    id VARCHAR(36) PRIMARY KEY,
    model_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    environment VARCHAR(50) NOT NULL DEFAULT 'staging',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    endpoint_url TEXT,
    config JSONB DEFAULT '{}'::JSONB,
    deployed_at TIMESTAMP WITH TIME ZONE,
    rollback_of VARCHAR(36),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_deployments_model FOREIGN KEY (model_id) REFERENCES mlops_models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mlops_deployments_model ON mlops_deployments(model_id);
CREATE INDEX IF NOT EXISTS idx_mlops_deployments_tenant ON mlops_deployments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mlops_deployments_status ON mlops_deployments(tenant_id, status);

CREATE TABLE IF NOT EXISTS mlops_metrics (
    id VARCHAR(36) PRIMARY KEY,
    model_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    metric_name VARCHAR(128) NOT NULL,
    metric_value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(32) DEFAULT '',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    tags JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_metrics_model FOREIGN KEY (model_id) REFERENCES mlops_models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mlops_metrics_model ON mlops_metrics(model_id);
CREATE INDEX IF NOT EXISTS idx_mlops_metrics_tenant ON mlops_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mlops_metrics_name ON mlops_metrics(model_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_mlops_metrics_timestamp ON mlops_metrics(model_id, timestamp DESC);