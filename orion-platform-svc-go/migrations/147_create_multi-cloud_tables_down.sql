-- Auto-generated rollback for version 147. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_migration_plans_created";

DROP INDEX IF EXISTS "idx_migration_plans_tenant";

DROP TABLE IF EXISTS "migration_plans" CASCADE;

DROP INDEX IF EXISTS "idx_scheduling_policies_created";

DROP INDEX IF EXISTS "idx_scheduling_policies_tenant";

DROP TABLE IF EXISTS "scheduling_policies" CASCADE;

DROP INDEX IF EXISTS "idx_cloud_resources_created";

DROP INDEX IF EXISTS "idx_cloud_resources_tenant";

DROP TABLE IF EXISTS "cloud_resources" CASCADE;

DROP INDEX IF EXISTS "idx_cloud_accounts_created";

DROP INDEX IF EXISTS "idx_cloud_accounts_tenant";
