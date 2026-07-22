-- Migration: 349_create_mlops_experiment_runs.sql
-- Purpose: Add ml_experiment_runs table for MLOps experiment tracking (completes migration 189)

CREATE TABLE IF NOT EXISTS ml_experiment_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    experiment_id UUID NOT NULL REFERENCES mlops_experiments(id),
    iteration   INTEGER NOT NULL DEFAULT 1,
    metrics     JSONB,
    status      VARCHAR(20) DEFAULT 'running',  -- running, completed, failed
    started_at  TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_run_status CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_ml_run_experiment ON ml_experiment_runs(experiment_id);
CREATE INDEX IF NOT EXISTS idx_ml_run_tenant ON ml_experiment_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ml_run_status ON ml_experiment_runs(status);
