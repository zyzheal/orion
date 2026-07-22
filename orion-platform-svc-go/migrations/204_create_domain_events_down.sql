-- Auto-generated rollback for version 204. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_domain_events_type";

DROP INDEX IF EXISTS "idx_domain_events_occurred";

DROP INDEX IF EXISTS "idx_domain_events_aggregate";

DROP INDEX IF EXISTS "idx_domain_events_tenant";
