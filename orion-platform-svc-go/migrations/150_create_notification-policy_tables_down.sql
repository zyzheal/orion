-- Auto-generated rollback for version 150. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_policy_workflows_created";

DROP INDEX IF EXISTS "idx_policy_workflows_tenant";

DROP TABLE IF EXISTS "policy_workflows" CASCADE;

DROP INDEX IF EXISTS "idx_policies_created";

DROP INDEX IF EXISTS "idx_policies_tenant";
