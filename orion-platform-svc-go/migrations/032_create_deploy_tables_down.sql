-- Auto-generated rollback for version 032. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP TABLE IF EXISTS "git_changelog_entries" CASCADE;

DROP TABLE IF EXISTS "release_notes" CASCADE;

DROP INDEX IF EXISTS "idx_deploy_audit_entries_tenant_id";

DROP TABLE IF EXISTS "deploy_audit_entries" CASCADE;

DROP INDEX IF EXISTS "idx_rollbacks_deployment_id";

DROP INDEX IF EXISTS "idx_rollbacks_tenant_id";

DROP TABLE IF EXISTS "rollbacks" CASCADE;

DROP INDEX IF EXISTS "idx_deployments_status";

DROP INDEX IF EXISTS "idx_deployments_environment";

DROP INDEX IF EXISTS "idx_deployments_app_name";

DROP INDEX IF EXISTS "idx_deployments_tenant_id";
