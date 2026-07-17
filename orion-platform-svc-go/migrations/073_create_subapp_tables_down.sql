-- Auto-generated rollback for version 073. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_subapp_config_histories_created_at";

DROP INDEX IF EXISTS "idx_subapp_config_histories_subapp_key";

DROP INDEX IF EXISTS "idx_subapp_config_histories_tenant_id";

DROP TABLE IF EXISTS "subapp_config_histories" CASCADE;

DROP INDEX IF EXISTS "idx_subapp_configs_sort_order";

DROP INDEX IF EXISTS "idx_subapp_configs_status";

DROP INDEX IF EXISTS "idx_subapp_configs_tenant_id";
