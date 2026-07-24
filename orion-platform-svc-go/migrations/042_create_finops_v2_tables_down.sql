-- Auto-generated rollback for version 042. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP TABLE IF EXISTS "collection_schedules" CASCADE;

DROP TABLE IF EXISTS "roi_entries" CASCADE;

DROP TABLE IF EXISTS "finops_reports" CASCADE;

DROP INDEX IF EXISTS "idx_recommendations_status";

DROP INDEX IF EXISTS "idx_recommendations_tenant_id";

DROP TABLE IF EXISTS "recommendations" CASCADE;

DROP INDEX IF EXISTS "idx_budgets_status";

DROP INDEX IF EXISTS "idx_budgets_tenant_id";

DROP TABLE IF EXISTS "budgets" CASCADE;

DROP INDEX IF EXISTS "idx_chargeback_entries_tenant_id";

DROP TABLE IF EXISTS "chargeback_entries" CASCADE;

DROP INDEX IF EXISTS "idx_cost_entries_period_start";

DROP INDEX IF EXISTS "idx_cost_entries_entity_id";

DROP INDEX IF EXISTS "idx_cost_entries_tenant_id";
