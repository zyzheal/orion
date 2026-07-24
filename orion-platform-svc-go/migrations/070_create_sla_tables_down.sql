-- Auto-generated rollback for version 070. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_sla_breach_events_breach_time";

DROP INDEX IF EXISTS "idx_sla_breach_events_tracking_id";

DROP INDEX IF EXISTS "idx_sla_breach_events_tenant_id";

DROP TABLE IF EXISTS "sla_breach_events" CASCADE;

DROP INDEX IF EXISTS "idx_sla_trackings_status";

DROP INDEX IF EXISTS "idx_sla_trackings_entity";

DROP INDEX IF EXISTS "idx_sla_trackings_sla_definition_id";

DROP INDEX IF EXISTS "idx_sla_trackings_tenant_id";

DROP TABLE IF EXISTS "sla_trackings" CASCADE;

DROP INDEX IF EXISTS "idx_sla_definitions_category";

DROP INDEX IF EXISTS "idx_sla_definitions_status";

DROP INDEX IF EXISTS "idx_sla_definitions_type";

DROP INDEX IF EXISTS "idx_sla_definitions_tenant_id";
