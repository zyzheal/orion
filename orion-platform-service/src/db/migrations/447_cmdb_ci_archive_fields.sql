-- ============================================================================
-- Task 5.5: CMDB CI archive/restore fields
-- ============================================================================
-- Adds archive tracking to cmdb_ci so CIs can be soft-archived (reversible)
-- without being hard-deleted. Archived CIs are excluded from default queries
-- and must be explicitly included via includeArchived=true.

-- ---------------------------------------------------------------------------
-- cmdb_ci archive columns
-- ---------------------------------------------------------------------------
ALTER TABLE cmdb_ci
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS archived_by INTEGER;

-- ---------------------------------------------------------------------------
-- Index for archived-CI queries (tenant + archive timestamp)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_archived
  ON cmdb_ci (tenant_id, archived_at)
  WHERE archived_at IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- DROP INDEX IF EXISTS idx_cmdb_ci_archived;
-- ALTER TABLE cmdb_ci DROP COLUMN IF EXISTS archived_by;
-- ALTER TABLE cmdb_ci DROP COLUMN IF EXISTS archived_at;
