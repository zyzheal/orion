-- Auto-generated rollback. Data loss may occur.

DROP INDEX IF EXISTS idx_test_generation_records_status;
DROP INDEX IF EXISTS idx_test_generation_records_created;
DROP INDEX IF EXISTS idx_test_generation_records_tenant;
DROP TABLE IF EXISTS test_generation_records;
