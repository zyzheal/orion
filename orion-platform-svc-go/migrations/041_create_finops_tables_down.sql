-- Auto-generated rollback for version 041. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_finops_cost_items_service";

DROP INDEX IF EXISTS "idx_finops_cost_items_tenant";

DROP TABLE IF EXISTS "finops_cost_items" CASCADE;

DROP INDEX IF EXISTS "idx_finops_anomalies_severity";

DROP INDEX IF EXISTS "idx_finops_anomalies_type";

DROP INDEX IF EXISTS "idx_finops_anomalies_tenant";

DROP TABLE IF EXISTS "finops_anomalies" CASCADE;

DROP INDEX IF EXISTS "idx_finops_budget_guards_tenant";
