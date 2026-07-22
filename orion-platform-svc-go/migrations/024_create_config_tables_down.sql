-- Auto-generated rollback for version 024. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP TABLE IF EXISTS "config_webhooks" CASCADE;

DROP TABLE IF EXISTS "config_snapshots" CASCADE;

DROP TABLE IF EXISTS "canary_deployments" CASCADE;

DROP TABLE IF EXISTS "config_template_versions" CASCADE;

DROP INDEX IF EXISTS "idx_config_templates_tenant_id";

DROP TABLE IF EXISTS "config_templates" CASCADE;

DROP INDEX IF EXISTS "idx_config_audit_entries_tenant_id";

DROP TABLE IF EXISTS "config_audit_entries" CASCADE;

DROP INDEX IF EXISTS "idx_change_requests_status";

DROP INDEX IF EXISTS "idx_change_requests_tenant_id";

DROP TABLE IF EXISTS "change_requests" CASCADE;

DROP TABLE IF EXISTS "gitops_sync_statuses" CASCADE;

DROP INDEX IF EXISTS "idx_gitops_configs_tenant_id";

DROP TABLE IF EXISTS "gitops_configs" CASCADE;

DROP INDEX IF EXISTS "idx_config_versions_config_id";

DROP INDEX IF EXISTS "idx_config_versions_tenant_id";

DROP TABLE IF EXISTS "config_versions" CASCADE;

DROP INDEX IF EXISTS "idx_configs_key";

DROP INDEX IF EXISTS "idx_configs_status";

DROP INDEX IF EXISTS "idx_configs_environment";

DROP INDEX IF EXISTS "idx_configs_tenant_id";
