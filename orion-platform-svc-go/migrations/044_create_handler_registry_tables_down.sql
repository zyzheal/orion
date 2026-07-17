-- Auto-generated rollback for version 044. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_handler_registry_entries_status";

DROP INDEX IF EXISTS "idx_handler_registry_entries_domain";

DROP INDEX IF EXISTS "idx_handler_registry_entries_tenant_id";

DROP TABLE IF EXISTS "handler_registry_entries" CASCADE;

DROP INDEX IF EXISTS "idx_handler_registries_tenant_id";
