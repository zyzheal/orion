-- Auto-generated rollback for version 059. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_tenant_quotas_tenant";

DROP INDEX IF EXISTS "idx_resource_quotas_plugin";

DROP INDEX IF EXISTS "idx_security_events_severity";

DROP INDEX IF EXISTS "idx_security_events_type";

DROP INDEX IF EXISTS "idx_security_events_tenant";

DROP INDEX IF EXISTS "idx_security_events_plugin";

DROP INDEX IF EXISTS "idx_audit_entries_level";

DROP INDEX IF EXISTS "idx_audit_entries_tenant";

DROP INDEX IF EXISTS "idx_audit_entries_task";

DROP INDEX IF EXISTS "idx_audit_entries_plugin";

DROP INDEX IF EXISTS "idx_plugin_executions_task";

DROP INDEX IF EXISTS "idx_plugin_executions_tenant";

DROP INDEX IF EXISTS "idx_plugin_executions_plugin";

DROP INDEX IF EXISTS "idx_plugins_tenant";
