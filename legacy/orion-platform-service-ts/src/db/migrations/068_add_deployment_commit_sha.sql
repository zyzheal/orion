-- Migration 068: Add commit_sha to deployments
-- For accurate Lead Time calculation (commit → deploy)

-- Add commit_sha column to deployments table
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS commit_sha VARCHAR(40);

-- Add commit_committed_at column for timestamp tracking
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS commit_committed_at TIMESTAMPTZ;

-- Add index for commit_sha lookups
CREATE INDEX IF NOT EXISTS idx_deployments_commit_sha ON deployments(commit_sha);

-- Comment on columns
COMMENT ON COLUMN deployments.commit_sha IS 'Git commit SHA that triggered this deployment';
COMMENT ON COLUMN deployments.commit_committed_at IS 'Timestamp when the commit was authored (for Lead Time calculation)';

-- Rollback:
-- ALTER TABLE deployments DROP COLUMN IF EXISTS commit_committed_at;
-- ALTER TABLE deployments DROP COLUMN IF EXISTS commit_sha;
-- DROP INDEX IF EXISTS idx_deployments_commit_sha;