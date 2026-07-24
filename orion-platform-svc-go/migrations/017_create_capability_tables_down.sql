-- Auto-generated rollback for version 017. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_permission_requests_status";

DROP INDEX IF EXISTS "idx_permission_requests_user_id";

DROP INDEX IF EXISTS "idx_permission_requests_tenant_id";

DROP TABLE IF EXISTS "permission_requests" CASCADE;

DROP INDEX IF EXISTS "idx_capability_audit_logs_user_id";

DROP INDEX IF EXISTS "idx_capability_audit_logs_tenant_id";

DROP TABLE IF EXISTS "capability_audit_logs" CASCADE;

DROP INDEX IF EXISTS "idx_temporary_permissions_capability_id";

DROP INDEX IF EXISTS "idx_temporary_permissions_user_id";

DROP INDEX IF EXISTS "idx_temporary_permissions_tenant_id";

DROP TABLE IF EXISTS "temporary_permissions" CASCADE;

DROP INDEX IF EXISTS "idx_capabilities_tenant_id";
