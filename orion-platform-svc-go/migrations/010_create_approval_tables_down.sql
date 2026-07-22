-- Auto-generated rollback for version 010. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_approval_gates_run_id";

DROP INDEX IF EXISTS "idx_approval_gates_tenant_id";

DROP TABLE IF EXISTS "approval_gates" CASCADE;

DROP INDEX IF EXISTS "idx_approval_templates_tenant_id";

DROP TABLE IF EXISTS "approval_templates" CASCADE;

DROP INDEX IF EXISTS "idx_approval_history_approval_id";

DROP INDEX IF EXISTS "idx_approval_history_tenant_id";

DROP TABLE IF EXISTS "approval_history" CASCADE;

DROP INDEX IF EXISTS "idx_approval_levels_approval_id";

DROP INDEX IF EXISTS "idx_approval_levels_tenant_id";

DROP TABLE IF EXISTS "approval_levels" CASCADE;

DROP INDEX IF EXISTS "idx_approval_requests_created_at";

DROP INDEX IF EXISTS "idx_approval_requests_status";

DROP INDEX IF EXISTS "idx_approval_requests_tenant_id";
