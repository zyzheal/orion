-- Auto-generated rollback for version 057. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_page_registry_histories_created_at";

DROP INDEX IF EXISTS "idx_page_registry_histories_page_id";

DROP INDEX IF EXISTS "idx_page_registry_histories_tenant_id";

DROP TABLE IF EXISTS "page_registry_histories" CASCADE;

DROP INDEX IF EXISTS "idx_page_registries_status";

DROP INDEX IF EXISTS "idx_page_registries_path";

DROP INDEX IF EXISTS "idx_page_registries_tenant_id";
