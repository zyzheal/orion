-- Auto-generated rollback. Data loss may occur.

DROP INDEX IF EXISTS idx_branch_policy_records_status;
DROP INDEX IF EXISTS idx_branch_policy_records_created;
DROP INDEX IF EXISTS idx_branch_policy_records_tenant;
DROP TABLE IF EXISTS branch_policy_records;
