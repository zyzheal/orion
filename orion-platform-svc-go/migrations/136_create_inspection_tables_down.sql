-- Auto-generated rollback for version 136. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS idx_inspection_records_status;
DROP INDEX IF EXISTS idx_inspection_records_created;
DROP INDEX IF EXISTS idx_inspection_records_tenant;
DROP TABLE IF EXISTS inspection_records;
