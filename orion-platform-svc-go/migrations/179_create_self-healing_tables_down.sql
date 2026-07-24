-- Auto-generated rollback for version 179. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_healing_incidents_created";

DROP INDEX IF EXISTS "idx_healing_incidents_tenant";
