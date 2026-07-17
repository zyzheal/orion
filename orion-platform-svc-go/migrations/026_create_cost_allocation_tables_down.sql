-- Auto-generated rollback for version 026. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_cost_allocation_tags_tenant";

DROP INDEX IF EXISTS "idx_cost_allocation_reports_allocation";

DROP INDEX IF EXISTS "idx_cost_allocation_reports_tenant";

DROP INDEX IF EXISTS "idx_cost_allocation_rules_allocation";

DROP INDEX IF EXISTS "idx_cost_allocations_tenant";

DROP TABLE IF EXISTS "cost_allocation_tags" CASCADE;

DROP TABLE IF EXISTS "cost_allocation_reports" CASCADE;

DROP TABLE IF EXISTS "cost_allocation_rules" CASCADE;
