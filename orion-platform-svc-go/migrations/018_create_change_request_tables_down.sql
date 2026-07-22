-- Auto-generated rollback for version 018. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_change_executions_request_id";

DROP INDEX IF EXISTS "idx_change_approvals_request_id";

DROP INDEX IF EXISTS "idx_change_requests_priority";

DROP INDEX IF EXISTS "idx_change_requests_status";

DROP INDEX IF EXISTS "idx_change_requests_tenant_id";

DROP TABLE IF EXISTS "change_executions" CASCADE;

DROP TABLE IF EXISTS "change_approvals" CASCADE;
