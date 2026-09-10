-- Auto-generated rollback. Data loss may occur.

DROP INDEX IF EXISTS idx_autonomous_pipeline_records_status;
DROP INDEX IF EXISTS idx_autonomous_pipeline_records_created;
DROP INDEX IF EXISTS idx_autonomous_pipeline_records_tenant;
DROP TABLE IF EXISTS autonomous_pipeline_records;
