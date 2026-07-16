-- ============================================================
-- Migration 413: DataPipeline Version Management
-- ============================================================
-- Purpose:
--   Add version management for data pipelines. Each time a pipeline
--   is updated, a snapshot of its definition (name, description,
--   stages, schedule, configs) is stored in pipeline_versions.
--
--   Enables:
--     - getVersions(pipelineId) — list version history
--     - rollbackVersion(pipelineId, version) — restore to a prior version
--
-- Tables:
--   pipeline_versions — stores immutable version snapshots
-- ============================================================

-- -------------------- pipeline_versions --------------------

CREATE TABLE IF NOT EXISTS pipeline_versions (
  id              VARCHAR(50)    PRIMARY KEY,
  pipeline_id     VARCHAR(50)    NOT NULL REFERENCES data_pipelines(id) ON DELETE CASCADE,
  tenant_id       VARCHAR(50)    NOT NULL,
  version_number  INTEGER        NOT NULL,
  name            VARCHAR(200)   NOT NULL,
  description     TEXT,
  stages          JSONB          NOT NULL DEFAULT '[]',
  schedule        VARCHAR(100),
  input_config    JSONB          NOT NULL DEFAULT '{}',
  processors      JSONB          NOT NULL DEFAULT '[]',
  output_config   JSONB          NOT NULL DEFAULT '{}',
  created_by      VARCHAR(100)   NOT NULL DEFAULT 'system',
  change_summary  TEXT,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  -- A pipeline version is immutable once created
  CONSTRAINT uq_pipeline_version UNIQUE (pipeline_id, version_number)
);

COMMENT ON TABLE    pipeline_versions      IS 'Immutable version snapshots for data pipelines';
COMMENT ON COLUMN   pipeline_versions.pipeline_id     IS 'FK to the pipeline this version belongs to';
COMMENT ON COLUMN   pipeline_versions.tenant_id        IS 'Tenant for multi-tenancy isolation';
COMMENT ON COLUMN   pipeline_versions.version_number   IS 'Monotonically increasing version per pipeline (1, 2, 3, ...)';
COMMENT ON COLUMN   pipeline_versions.name             IS 'Pipeline name at the time of this version';
COMMENT ON COLUMN   pipeline_versions.description      IS 'Pipeline description at the time of this version';
COMMENT ON COLUMN   pipeline_versions.stages           IS 'Ordered stage definitions (JSONB array)';
COMMENT ON COLUMN   pipeline_versions.schedule         IS 'Cron schedule at the time of this version';
COMMENT ON COLUMN   pipeline_versions.input_config     IS 'Input configuration snapshot';
COMMENT ON COLUMN   pipeline_versions.processors       IS 'Processor definitions snapshot';
COMMENT ON COLUMN   pipeline_versions.output_config    IS 'Output configuration snapshot';
COMMENT ON COLUMN   pipeline_versions.created_by       IS 'Who created this version (user or system)';
COMMENT ON COLUMN   pipeline_versions.change_summary    IS 'Optional human-readable description of what changed';

-- -------------------- indexes --------------------

-- Find all versions for a pipeline quickly
CREATE INDEX IF NOT EXISTS idx_pv_pipeline
  ON pipeline_versions (pipeline_id);

-- Tenant-scoped queries (e.g., list all versions across pipelines for a tenant)
CREATE INDEX IF NOT EXISTS idx_pv_tenant_pipeline
  ON pipeline_versions (tenant_id, pipeline_id, version_number DESC);

-- Unique version number per pipeline is enforced by the composite constraint above.
