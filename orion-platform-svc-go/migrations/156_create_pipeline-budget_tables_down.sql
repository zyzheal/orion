-- Auto-generated rollback for version 156. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_budget_history_records_created";

DROP INDEX IF EXISTS "idx_budget_history_records_tenant";

DROP TABLE IF EXISTS "budget_history_records" CASCADE;

DROP INDEX IF EXISTS "idx_budget_configs_created";

DROP INDEX IF EXISTS "idx_budget_configs_tenant";
