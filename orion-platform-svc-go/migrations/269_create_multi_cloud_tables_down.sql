-- Auto-generated rollback for version 054. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_migration_plans_status";

DROP INDEX IF EXISTS "idx_migration_plans_tenant_id";

DROP TABLE IF EXISTS "migration_plans" CASCADE;

DROP INDEX IF EXISTS "idx_scheduling_policies_tenant_id";

DROP TABLE IF EXISTS "scheduling_policies" CASCADE;

DROP INDEX IF EXISTS "idx_cloud_resources_provider";

DROP INDEX IF EXISTS "idx_cloud_resources_account_id";

DROP INDEX IF EXISTS "idx_cloud_resources_tenant_id";

DROP TABLE IF EXISTS "cloud_resources" CASCADE;

DROP INDEX IF EXISTS "idx_cloud_accounts_region";

DROP INDEX IF EXISTS "idx_cloud_accounts_provider_id";

DROP INDEX IF EXISTS "idx_cloud_accounts_tenant_id";
