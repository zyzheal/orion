-- Migration 178: Add version and yaml_definition columns to pipelines table
-- These columns are required by PipelineService but missing from the original schema

ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS yaml_definition TEXT;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS spec JSONB;

-- Rollback:
-- ALTER TABLE pipelines DROP COLUMN IF EXISTS version;
-- ALTER TABLE pipelines DROP COLUMN IF EXISTS yaml_definition;
-- ALTER TABLE pipelines DROP COLUMN IF EXISTS spec;
