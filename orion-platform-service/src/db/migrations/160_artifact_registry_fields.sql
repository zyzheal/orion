-- 160: Artifact Registry Fields
-- Add columns for full artifact registry support (M29)
-- Adds namespace, version, stage, status, display_name, description, labels, annotations, etc.

ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS namespace VARCHAR(100);
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS version VARCHAR(50);
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS stage VARCHAR(50) NOT NULL DEFAULT 'snapshot';
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'available';
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS display_name VARCHAR(200);
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS labels JSONB NOT NULL DEFAULT '{}';
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS annotations JSONB NOT NULL DEFAULT '{}';
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS storage_backend VARCHAR(50) NOT NULL DEFAULT 'local';
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS retention_days INTEGER;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS cleanup_policy VARCHAR(50);
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS product_line_id VARCHAR(100);

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_artifacts_namespace ON artifacts(namespace) WHERE namespace IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artifacts_version ON artifacts(version) WHERE version IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artifacts_stage ON artifacts(stage);
CREATE INDEX IF NOT EXISTS idx_artifacts_status ON artifacts(status);
CREATE INDEX IF NOT EXISTS idx_artifacts_product_line ON artifacts(product_line_id) WHERE product_line_id IS NOT NULL;

-- Run_id constraint may fail if pipeline_runs has no rows; make it nullable to be safe
ALTER TABLE artifacts ALTER COLUMN run_id DROP NOT NULL;
