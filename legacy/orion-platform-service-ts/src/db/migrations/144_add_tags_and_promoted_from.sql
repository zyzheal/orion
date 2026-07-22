-- Migration 144: Add tags and promoted_from to artifact_version_tracking
-- Support for version tagging and promotion chain (lineage)

ALTER TABLE artifact_version_tracking
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS promoted_from UUID REFERENCES artifact_version_tracking(id) ON DELETE SET NULL;

-- Index for tag lookup
CREATE INDEX idx_artifact_version_tracking_tags
  ON artifact_version_tracking USING gin(tags);

-- Index for promotion chain traversal
CREATE INDEX idx_artifact_version_tracking_promoted_from
  ON artifact_version_tracking(promoted_from)
  WHERE promoted_from IS NOT NULL;
