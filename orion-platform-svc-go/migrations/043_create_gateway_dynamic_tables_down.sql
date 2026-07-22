-- Auto-generated rollback for version 043. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_gateway_routes_enabled";

DROP INDEX IF EXISTS "idx_gateway_routes_path";

DROP INDEX IF EXISTS "idx_gateway_routes_tenant_id";
