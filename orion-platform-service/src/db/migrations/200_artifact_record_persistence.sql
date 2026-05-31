-- Migration 200: Artifact Record Persistence
-- Migrates ArtifactService from in-memory Map index to PostgreSQL
-- Stores artifact metadata (file paths, sizes, MIME types) for pipeline stage artifacts

CREATE TABLE IF NOT EXISTS artifact_records (
  id          VARCHAR(100) PRIMARY KEY,
  tenant_id   VARCHAR(100) NOT NULL DEFAULT 'system',
  run_id      VARCHAR(100) NOT NULL,
  stage_id    VARCHAR(100) NOT NULL,
  name        VARCHAR(500) NOT NULL,
  size        INTEGER NOT NULL DEFAULT 0,
  mime_type   VARCHAR(200),
  file_path   VARCHAR(1000) NOT NULL,
  uploaded_by VARCHAR(200),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifact_records_run ON artifact_records(run_id);
CREATE INDEX IF NOT EXISTS idx_artifact_records_stage ON artifact_records(run_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_artifact_records_tenant ON artifact_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifact_records_name ON artifact_records(run_id, stage_id, name);
CREATE INDEX IF NOT EXISTS idx_artifact_records_created ON artifact_records(created_at);

COMMENT ON TABLE artifact_records IS 'Pipeline artifact metadata - tracks files produced by pipeline stages';
COMMENT ON COLUMN artifact_records.run_id IS 'Pipeline run ID that produced this artifact';
COMMENT ON COLUMN artifact_records.stage_id IS 'Pipeline stage ID that produced this artifact';
COMMENT ON COLUMN artifact_records.file_path IS 'Absolute filesystem path to the artifact file';

-- Rollback:
-- DROP TABLE IF EXISTS artifact_records;
