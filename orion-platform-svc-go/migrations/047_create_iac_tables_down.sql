-- Auto-generated rollback for version 047. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_iac_resources_type";

DROP INDEX IF EXISTS "idx_iac_resources_workspace_id";

DROP INDEX IF EXISTS "idx_iac_resources_tenant_id";

DROP TABLE IF EXISTS "iac_resources" CASCADE;

DROP INDEX IF EXISTS "idx_iac_state_versions_workspace_id";

DROP INDEX IF EXISTS "idx_iac_state_versions_tenant_id";

DROP TABLE IF EXISTS "iac_state_versions" CASCADE;

DROP INDEX IF EXISTS "idx_iac_plans_status";

DROP INDEX IF EXISTS "idx_iac_plans_workspace_id";

DROP INDEX IF EXISTS "idx_iac_plans_tenant_id";

DROP TABLE IF EXISTS "iac_plans" CASCADE;

DROP INDEX IF EXISTS "idx_iac_workspace_modules_tenant_id";

DROP TABLE IF EXISTS "iac_workspace_modules" CASCADE;

DROP INDEX IF EXISTS "idx_iac_workspaces_status";

DROP INDEX IF EXISTS "idx_iac_workspaces_tenant_id";
