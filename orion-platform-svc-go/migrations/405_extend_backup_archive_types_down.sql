-- Reverse 405_extend_backup_archive_types.sql.
--
-- REVERSIBLE WITH CAUTION: this down rebuilds the original CHECK constraint.
-- If any row in backup_archive holds archive_type IN
-- ('archivelog','redolog','log_backup','clog') -- the four values 405 added
-- -- the narrower constraint will REJECT that row on insert and the down will
-- fail with a constraint violation. Before running this file, verify:
--
--   SELECT COUNT(*) FROM backup_archive
--   WHERE archive_type IN ('archivelog','redolog','log_backup','clog');
--
-- If the count is non-zero, either migrate those rows to a backup format
-- the original constraint accepts, or skip this down and roll forward.

ALTER TABLE backup_archive DROP CONSTRAINT IF EXISTS backup_archive_archive_type_check;
ALTER TABLE backup_archive ADD CONSTRAINT backup_archive_archive_type_check
    CHECK (archive_type IN ('wal','binlog'));
