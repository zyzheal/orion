-- Auto-generated rollback. Data loss may occur.

DROP INDEX IF EXISTS idx_middleware_ops_records_status;
DROP INDEX IF EXISTS idx_middleware_ops_records_created;
DROP INDEX IF EXISTS idx_middleware_ops_records_tenant;
DROP TABLE IF EXISTS middleware_ops_records;
