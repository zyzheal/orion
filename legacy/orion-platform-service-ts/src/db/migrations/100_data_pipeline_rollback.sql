-- Rollback Migration 100_data_pipeline
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: data_pipelines
DROP TABLE IF EXISTS data_pipelines CASCADE;

-- Dropping table: pipeline_schedules
DROP TABLE IF EXISTS pipeline_schedules CASCADE;

-- Dropping table: data_lineage
DROP TABLE IF EXISTS data_lineage CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_data_pipeline;
DROP INDEX IF EXISTS CREATE INDEX idx_data_pipeline;
DROP INDEX IF EXISTS CREATE INDEX idx_data_pipeline;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_;
DROP INDEX IF EXISTS CREATE INDEX idx_pipeline_;
DROP INDEX IF EXISTS CREATE INDEX idx_data_lineage_tenant ON data_lineage(tenant_id);;
DROP INDEX IF EXISTS CREATE INDEX idx_data_lineage_;
DROP INDEX IF EXISTS CREATE INDEX idx_data_lineage_target ON data_lineage(target_table, target_column);;
DROP INDEX IF EXISTS CREATE INDEX idx_data_lineage_pipeline ON data_lineage(pipeline_id);;
