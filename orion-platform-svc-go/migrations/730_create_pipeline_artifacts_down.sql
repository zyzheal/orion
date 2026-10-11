-- Migration 730 down: Drop pipeline_artifacts table

BEGIN;

-- 依赖顺序: 先删索引, 再删表 (与 up 相反)
DROP INDEX IF EXISTS idx_pipeline_artifacts_tenant;
DROP INDEX IF EXISTS idx_pipeline_artifacts_expires;
DROP INDEX IF EXISTS idx_pipeline_artifacts_stage;
DROP INDEX IF EXISTS idx_pipeline_artifacts_run;

DROP TABLE IF EXISTS pipeline_artifacts;

COMMIT;
