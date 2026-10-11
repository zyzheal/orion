-- Migration 731 down: Remove artifact_count from pipeline_runs

BEGIN;

ALTER TABLE pipeline_runs DROP COLUMN IF EXISTS artifact_count;

COMMIT;
