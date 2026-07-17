-- Auto-generated rollback for version 164. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_plugin_hotreloads_created";

DROP INDEX IF EXISTS "idx_plugin_hotreloads_tenant";
