-- ============================================================
-- Rollback Migration 412: DataPipeline Schema Fixes
-- ============================================================
-- Reverses the schema changes introduced by
-- 412_datapipeline_schema_fixes.sql
--
-- WARNING: Rolling back will DELETE all data stored in the
-- columns added by migration 412 (input_config, processors,
-- output_config, created_by, last_run_id, input_count,
-- output_count, error_message) because DROP COLUMN removes
-- the column and its data.
-- ============================================================

-- Drop composite index
DROP INDEX IF EXISTS idx_dp_tenant_status;

-- Drop columns added to pipeline_executions
ALTER TABLE pipeline_executions
  DROP COLUMN IF EXISTS error_message,
  DROP COLUMN IF EXISTS output_count,
  DROP COLUMN IF EXISTS input_count;

-- Drop columns added to data_pipelines
ALTER TABLE data_pipelines
  DROP COLUMN IF EXISTS last_run_id,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS output_config,
  DROP COLUMN IF EXISTS processors,
  DROP COLUMN IF EXISTS input_config;
