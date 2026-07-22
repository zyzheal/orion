-- Auto-generated rollback for version 035. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP TABLE IF EXISTS "replay_sessions" CASCADE;

DROP TABLE IF EXISTS "recording_sessions" CASCADE;

DROP INDEX IF EXISTS "idx_traffic_records_twin_id";

DROP INDEX IF EXISTS "idx_traffic_records_tenant_id";

DROP TABLE IF EXISTS "traffic_records" CASCADE;

DROP INDEX IF EXISTS "idx_snapshots_twin_id";

DROP INDEX IF EXISTS "idx_snapshots_tenant_id";

DROP TABLE IF EXISTS "snapshots" CASCADE;

DROP INDEX IF EXISTS "idx_digital_twins_tenant_id";
