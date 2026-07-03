-- ============================================================
-- Migration 412: DataPipeline Schema Fixes
-- ============================================================
-- Purpose:
--   Fix schema gaps between migration 355 and the DataPipeline
--   TypeScript model/service layer. Adds missing columns that
--   the service expects when persisting to PostgreSQL.
--
--   Adds to data_pipelines:
--     - input_config    (JSONB)  pipeline input configuration
--     - processors      (JSONB)  ordered processor definitions
--     - output_config   (JSONB)  pipeline output configuration
--     - created_by      (VARCHAR) who created the pipeline
--     - last_run_id     (VARCHAR) id of most recent execution
--
--   Adds to pipeline_executions:
--     - input_count     (INTEGER) records consumed
--     - output_count    (INTEGER) records produced
--     - error_message   (TEXT)    execution-level error detail
--
--   Adds index:
--     - idx_dp_tenant_status  composite (tenant_id, status)
-- ============================================================

-- -------------------- data_pipelines --------------------

ALTER TABLE data_pipelines
  ADD COLUMN IF NOT EXISTS input_config  JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS processors    JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS output_config JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_by    VARCHAR(100) NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS last_run_id   VARCHAR(50);

COMMENT ON COLUMN data_pipelines.input_config  IS 'Pipeline input source configuration';
COMMENT ON COLUMN data_pipelines.processors    IS 'Ordered processor/transformer definitions';
COMMENT ON COLUMN data_pipelines.output_config IS 'Pipeline output target configuration';
COMMENT ON COLUMN data_pipelines.created_by    IS 'User or system that created the pipeline';
COMMENT ON COLUMN data_pipelines.last_run_id   IS 'ID of the most recent pipeline execution';

-- Backfill default values for pre-existing rows
UPDATE data_pipelines
   SET input_config  = COALESCE(input_config,  '{}'),
       processors    = COALESCE(processors,    '[]'),
       output_config = COALESCE(output_config, '{}'),
       created_by    = COALESCE(created_by,    'system')
 WHERE input_config IS NULL
    OR processors IS NULL
    OR output_config IS NULL
    OR created_by IS NULL;

-- -------------------- pipeline_executions --------------------

ALTER TABLE pipeline_executions
  ADD COLUMN IF NOT EXISTS input_count   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_count  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMENT ON COLUMN pipeline_executions.input_count   IS 'Number of records consumed by this execution';
COMMENT ON COLUMN pipeline_executions.output_count  IS 'Number of records produced by this execution';
COMMENT ON COLUMN pipeline_executions.error_message IS 'Human-readable execution-level error message';

UPDATE pipeline_executions
   SET input_count  = COALESCE(input_count,  0),
       output_count = COALESCE(output_count, 0)
 WHERE input_count IS NULL
    OR output_count IS NULL;

-- -------------------- indexes --------------------

-- Composite index: tenant + status is the most common query pattern
-- (findByTenant already filters tenant, findByStatus filters status;
--  combined queries benefit from this composite index)
CREATE INDEX IF NOT EXISTS idx_dp_tenant_status
  ON data_pipelines (tenant_id, status);
