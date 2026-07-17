-- Auto-generated rollback for version 087. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_degradation_histories_created";

DROP INDEX IF EXISTS "idx_degradation_histories_tenant";

DROP TABLE IF EXISTS "degradation_histories" CASCADE;

DROP INDEX IF EXISTS "idx_degradation_configs_created";

DROP INDEX IF EXISTS "idx_degradation_configs_tenant";
