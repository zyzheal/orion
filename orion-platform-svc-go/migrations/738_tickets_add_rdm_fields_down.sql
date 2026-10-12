-- Rollback 738
ALTER TABLE tickets
    DROP COLUMN IF EXISTS parent_id,
    DROP COLUMN IF EXISTS sprint_id,
    DROP COLUMN IF EXISTS repo_ref,
    DROP COLUMN IF EXISTS labels,
    DROP COLUMN IF EXISTS story_points,
    DROP COLUMN IF EXISTS severity;

DROP INDEX IF EXISTS idx_tickets_parent;
DROP INDEX IF EXISTS idx_tickets_sprint;
