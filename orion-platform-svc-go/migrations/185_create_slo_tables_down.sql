-- Auto-generated rollback for version 185. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_error_budgets_created";

DROP INDEX IF EXISTS "idx_error_budgets_tenant";

DROP TABLE IF EXISTS "error_budgets" CASCADE;

DROP INDEX IF EXISTS "idx_s_l_i_measurements_created";

DROP INDEX IF EXISTS "idx_s_l_i_measurements_tenant";

DROP TABLE IF EXISTS "s_l_i_measurements" CASCADE;

DROP INDEX IF EXISTS "idx_s_l_o_definitions_created";

DROP INDEX IF EXISTS "idx_s_l_o_definitions_tenant";
