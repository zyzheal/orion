-- Auto-generated rollback for version 174. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_scheduled_notifications_created";

DROP INDEX IF EXISTS "idx_scheduled_notifications_tenant";
