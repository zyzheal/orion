-- Auto-generated rollback for version 016. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_build_logs_build_id";

DROP INDEX IF EXISTS "idx_build_logs_tenant_id";

DROP TABLE IF EXISTS "build_logs" CASCADE;

DROP INDEX IF EXISTS "idx_build_cache_entries_key";

DROP INDEX IF EXISTS "idx_build_cache_entries_config_id";

DROP TABLE IF EXISTS "build_cache_entries" CASCADE;

DROP INDEX IF EXISTS "idx_build_cache_configs_tenant_id";

DROP TABLE IF EXISTS "build_cache_configs" CASCADE;

DROP INDEX IF EXISTS "idx_build_images_tenant_id";

DROP TABLE IF EXISTS "build_images" CASCADE;

DROP INDEX IF EXISTS "idx_builds_status";

DROP INDEX IF EXISTS "idx_builds_tenant_id";
