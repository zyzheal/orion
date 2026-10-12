-- Rollback 709
ALTER TABLE cmdb_ci_types
    DROP COLUMN IF EXISTS attributes,
    DROP COLUMN IF EXISTS icon,
    DROP COLUMN IF EXISTS category;

DROP INDEX IF EXISTS idx_cmdb_ci_types_category;
