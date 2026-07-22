-- Auto-generated rollback for version 123. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_simulations_created";

DROP INDEX IF EXISTS "idx_simulations_tenant";

DROP TABLE IF EXISTS "simulations" CASCADE;

DROP INDEX IF EXISTS "idx_digital_twins_created";

DROP INDEX IF EXISTS "idx_digital_twins_tenant";
