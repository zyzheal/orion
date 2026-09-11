-- Auto-generated rollback for version 055. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_notification_templates_enabled";

DROP INDEX IF EXISTS "idx_notification_templates_channel";

DROP INDEX IF EXISTS "idx_notification_templates_tenant";
