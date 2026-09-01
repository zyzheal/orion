-- Migration 405: extend backup_archive.archive_type CHECK constraint
-- Adds Oracle archivelog, DB2 redo log, SQL Server log_backup, and
-- OceanBase clog to the accepted values. Existing deployments get a new
-- constraint via the DROP + ADD sequence.

ALTER TABLE backup_archive DROP CONSTRAINT IF EXISTS backup_archive_archive_type_check;
ALTER TABLE backup_archive ADD CONSTRAINT backup_archive_archive_type_check
    CHECK (archive_type IN ('wal','binlog','archivelog','redolog','log_backup','clog'));
