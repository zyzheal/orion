-- Auto-generated rollback for version 196. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_u_e_b_a_profiles_created";

DROP INDEX IF EXISTS "idx_u_e_b_a_profiles_tenant";

DROP TABLE IF EXISTS "u_e_b_a_profiles" CASCADE;

DROP INDEX IF EXISTS "idx_u_e_b_a_alerts_created";

DROP INDEX IF EXISTS "idx_u_e_b_a_alerts_tenant";
