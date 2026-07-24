-- Auto-generated rollback for version 068. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_service_registries_last_heartbeat_at";

DROP INDEX IF EXISTS "idx_service_registries_health_status";

DROP INDEX IF EXISTS "idx_service_registries_status";

DROP INDEX IF EXISTS "idx_service_registries_service_name";

DROP INDEX IF EXISTS "idx_service_registries_tenant_id";
