-- Auto-generated rollback for version 038. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_events_occurred_at";

DROP INDEX IF EXISTS "idx_events_type";

DROP INDEX IF EXISTS "idx_events_tenant_id";
