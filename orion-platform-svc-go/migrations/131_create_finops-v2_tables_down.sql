-- Auto-generated rollback for version 131. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_r_o_i_entries_created";

DROP INDEX IF EXISTS "idx_r_o_i_entries_tenant";

DROP TABLE IF EXISTS "r_o_i_entries" CASCADE;

DROP INDEX IF EXISTS "idx_reports_created";

DROP INDEX IF EXISTS "idx_reports_tenant";

DROP TABLE IF EXISTS "reports" CASCADE;

DROP INDEX IF EXISTS "idx_recommendations_created";

DROP INDEX IF EXISTS "idx_recommendations_tenant";

DROP TABLE IF EXISTS "recommendations" CASCADE;

DROP INDEX IF EXISTS "idx_budgets_created";

DROP INDEX IF EXISTS "idx_budgets_tenant";

DROP TABLE IF EXISTS "budgets" CASCADE;

DROP INDEX IF EXISTS "idx_chargeback_entries_created";

DROP INDEX IF EXISTS "idx_chargeback_entries_tenant";

DROP TABLE IF EXISTS "chargeback_entries" CASCADE;

DROP INDEX IF EXISTS "idx_cost_entries_created";

DROP INDEX IF EXISTS "idx_cost_entries_tenant";
