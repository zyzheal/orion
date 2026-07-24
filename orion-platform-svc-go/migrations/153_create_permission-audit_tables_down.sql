-- Auto-generated rollback for version 153. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_permission_audit_logs_created";

DROP INDEX IF EXISTS "idx_permission_audit_logs_tenant";
