-- Migration: 189_create_mlops_tables.sql
-- Purpose: Create tables for MLOps module (Phase 4 Batch 2)

-- ML Experiments
CREATE TABLE IF NOT EXISTS mlops_experiments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   BIGINT NOT NULL DEFAULT 1,
    name        VARCHAR(255) NOT NULL,
    project     VARCHAR(100),
    status      VARCHAR(20) DEFAULT 'draft',  -- draft, running, completed, failed
    model_type  VARCHAR(100),
    metrics     JSONB,
    hyperparams JSONB,
    started_at  TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_experiment_status CHECK (status IN ('draft', 'running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_mlops_exp_tenant ON mlops_experiments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mlops_exp_status ON mlops_experiments(status);

-- ML Models (Registry)
CREATE TABLE IF NOT EXISTS mlops_models (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   BIGINT NOT NULL DEFAULT 1,
    name        VARCHAR(255) NOT NULL,
    version     INTEGER NOT NULL DEFAULT 1,
    experiment_id UUID REFERENCES mlops_experiments(id),
    status      VARCHAR(20) DEFAULT 'draft',  -- draft, staging, production, archived
    artifact_path VARCHAR(500),
    metrics     JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_model_status CHECK (status IN ('draft', 'staging', 'production', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_mlops_model_tenant ON mlops_models(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mlops_model_status ON mlops_models(status);

-- ML Training Jobs
CREATE TABLE IF NOT EXISTS mlops_training_jobs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   BIGINT NOT NULL DEFAULT 1,
    experiment_id UUID REFERENCES mlops_experiments(id),
    model_id    UUID REFERENCES mlops_models(id),
    status      VARCHAR(20) DEFAULT 'pending',  -- pending, running, completed, failed
    dataset     VARCHAR(255),
    config      JSONB,
    logs        TEXT,
    started_at  TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_training_job_status CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_mlops_job_tenant ON mlops_training_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mlops_job_status ON mlops_training_jobs(status);
