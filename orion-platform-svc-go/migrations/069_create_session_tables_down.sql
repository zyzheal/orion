-- Auto-generated rollback for version 069. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_sessions_expires_at";

DROP INDEX IF EXISTS "idx_sessions_tenant_id";

DROP INDEX IF EXISTS "idx_sessions_user_id";
