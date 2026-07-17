-- Auto-generated rollback for version 159. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_s_s_e_status_event_records_created";

DROP INDEX IF EXISTS "idx_s_s_e_status_event_records_tenant";

DROP TABLE IF EXISTS "s_s_e_status_event_records" CASCADE;

DROP INDEX IF EXISTS "idx_s_s_e_log_event_records_created";

DROP INDEX IF EXISTS "idx_s_s_e_log_event_records_tenant";
