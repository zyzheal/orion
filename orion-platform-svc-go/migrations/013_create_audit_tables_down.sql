-- Auto-generated rollback for version 013. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_audit_logs_created_at";

DROP INDEX IF EXISTS "idx_audit_logs_resource_type";

DROP INDEX IF EXISTS "idx_audit_logs_action";

DROP INDEX IF EXISTS "idx_audit_logs_user_id";

DROP INDEX IF EXISTS "idx_audit_logs_tenant_id";
