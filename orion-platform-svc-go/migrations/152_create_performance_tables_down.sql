-- Auto-generated rollback for version 152. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_profiles_created";

DROP INDEX IF EXISTS "idx_profiles_tenant";

DROP TABLE IF EXISTS "profiles" CASCADE;

DROP INDEX IF EXISTS "idx_evaluations_created";

DROP INDEX IF EXISTS "idx_evaluations_tenant";

DROP TABLE IF EXISTS "evaluations" CASCADE;

DROP INDEX IF EXISTS "idx_baselines_created";

DROP INDEX IF EXISTS "idx_baselines_tenant";
