-- Auto-generated rollback for version 075. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_tenant_quota_alerts_notify_status";

DROP INDEX IF EXISTS "idx_tenant_quota_alerts_tenant_id";

DROP TABLE IF EXISTS "tenant_quota_alerts" CASCADE;

DROP INDEX IF EXISTS "idx_tenant_quotas_tenant_id";

DROP TABLE IF EXISTS "tenant_quotas" CASCADE;

DROP INDEX IF EXISTS "idx_namespace_allocations_status";

DROP INDEX IF EXISTS "idx_namespace_allocations_tenant_id";

DROP TABLE IF EXISTS "namespace_allocations" CASCADE;

DROP INDEX IF EXISTS "idx_tenant_invites_expires_at";

DROP INDEX IF EXISTS "idx_tenant_invites_status";

DROP INDEX IF EXISTS "idx_tenant_invites_email";

DROP INDEX IF EXISTS "idx_tenant_invites_tenant_id";

DROP TABLE IF EXISTS "tenant_invites" CASCADE;

DROP INDEX IF EXISTS "idx_tenant_users_user_id";

DROP INDEX IF EXISTS "idx_tenant_users_tenant_id";

DROP TABLE IF EXISTS "tenant_users" CASCADE;

DROP INDEX IF EXISTS "idx_tenants_name";

DROP INDEX IF EXISTS "idx_tenants_status";
