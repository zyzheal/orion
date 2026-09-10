-- Auto-generated rollback. Data loss may occur.

DROP INDEX IF EXISTS idx_confirmation_records_status;
DROP INDEX IF EXISTS idx_confirmation_records_created;
DROP INDEX IF EXISTS idx_confirmation_records_tenant;
DROP TABLE IF EXISTS confirmation_records;
