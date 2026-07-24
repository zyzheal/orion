-- Auto-generated rollback for version 006. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_usage_limits_tenant";

DROP INDEX IF EXISTS "idx_api_consumptions_date";

DROP INDEX IF EXISTS "idx_api_consumptions_tenant";

DROP TABLE IF EXISTS "usage_limits" CASCADE;
