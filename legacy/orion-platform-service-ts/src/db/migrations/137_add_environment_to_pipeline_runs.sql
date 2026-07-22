-- Migration 137: Add environment support to pipeline_runs
-- GAP-CN-02: Multi-environment management for pipeline deployments.
-- Adds environment_name column to track which environment a pipeline run targets.

ALTER TABLE pipeline_runs
ADD COLUMN IF NOT EXISTS environment_name VARCHAR(64),
ADD CONSTRAINT fk_pipeline_runs_environment
    FOREIGN KEY (tenant_id, environment_name)
    REFERENCES pipeline_environments(tenant_id, name)
    ON DELETE SET NULL;

CREATE INDEX idx_pipeline_runs_env ON pipeline_runs(tenant_id, environment_name);

COMMENT ON COLUMN pipeline_runs.environment_name IS 'Target deployment environment (development, staging, production, etc.)';

-- Rollback:
-- ALTER TABLE pipeline_runs DROP CONSTRAINT IF EXISTS fk_pipeline_runs_environment;
-- ALTER TABLE pipeline_runs DROP COLUMN IF EXISTS environment_name;
-- DROP INDEX IF EXISTS idx_pipeline_runs_env;
