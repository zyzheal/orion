-- Auto-generated rollback for version 049. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_incident_postmortems_status";

DROP INDEX IF EXISTS "idx_incident_postmortems_tenant_id";

DROP INDEX IF EXISTS "idx_incident_postmortems_incident_id";

DROP TABLE IF EXISTS "incident_postmortems" CASCADE;

DROP INDEX IF EXISTS "idx_incident_timeline_events_tenant_id";

DROP INDEX IF EXISTS "idx_incident_timeline_events_incident_id";

DROP TABLE IF EXISTS "incident_timeline_events" CASCADE;

DROP INDEX IF EXISTS "idx_incident_escalations_tenant_id";

DROP INDEX IF EXISTS "idx_incident_escalations_incident_id";

DROP TABLE IF EXISTS "incident_escalations" CASCADE;

DROP INDEX IF EXISTS "idx_incidents_created_at";

DROP INDEX IF EXISTS "idx_incidents_severity";

DROP INDEX IF EXISTS "idx_incidents_status";

DROP INDEX IF EXISTS "idx_incidents_tenant_id";
