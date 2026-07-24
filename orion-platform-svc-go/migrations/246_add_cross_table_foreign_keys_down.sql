-- Rollback for migration 246: Remove cross-table foreign key constraints added by 246.
-- Drops only the constraints introduced by migration 246, leaving parent/child tables intact.

BEGIN;

ALTER TABLE ONLY plugin_audit_entries
  DROP CONSTRAINT IF EXISTS fk_plugin_audit_entries_plugin_id;

ALTER TABLE ONLY plugin_security_events
  DROP CONSTRAINT IF EXISTS fk_plugin_security_events_plugin_id;

ALTER TABLE ONLY plugin_resource_quotas
  DROP CONSTRAINT IF EXISTS fk_plugin_resource_quotas_plugin_id;

ALTER TABLE ONLY library_versions
  DROP CONSTRAINT IF EXISTS fk_library_versions_artifact_id;

ALTER TABLE ONLY problem_incident_links
  DROP CONSTRAINT IF EXISTS fk_problem_incident_links_incident_id;

ALTER TABLE ONLY tickets
  DROP CONSTRAINT IF EXISTS fk_tickets_sla_policy_id;

COMMIT;
