-- Auto-generated rollback for version 091. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_alert_breakers_created";

DROP INDEX IF EXISTS "idx_alert_breakers_tenant";
