-- Rollback: drop the CQRS pipeline run projection table and its indexes.
DROP INDEX IF EXISTS idx_pipeline_run_projections_updated_at;
DROP INDEX IF EXISTS idx_pipeline_run_projections_tenant;
DROP TABLE IF EXISTS pipeline_run_projections;
