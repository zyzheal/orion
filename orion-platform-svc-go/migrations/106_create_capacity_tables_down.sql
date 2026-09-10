-- Auto-generated rollback for version 106. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS idx_capacity_records_status;
DROP INDEX IF EXISTS idx_capacity_records_created;
DROP INDEX IF EXISTS idx_capacity_records_tenant;
DROP TABLE IF EXISTS capacity_records;
