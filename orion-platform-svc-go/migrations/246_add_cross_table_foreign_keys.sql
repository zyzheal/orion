-- Migration 246: Add missing cross-table foreign key constraints
-- These FKs were not covered by migration 240 (tenant_id/user_id FKs) or 242 (audit columns).
-- Pattern: NOT VALID + VALIDATE, idempotent via DO $$ BEGIN / IF NOT EXISTS.
--
-- Parent table verification:
--   plugins            -> 059_create_plugin_tables.sql
--   artifacts          -> 012_create_artifact_tables.sql
--   incidents          -> 049_create_incident_tables.sql
--   ticket_sla_policies -> 076_create_ticketing_tables.sql
--
-- On-delete actions:
--   SET NULL  when child can live without parent (nullable columns).
--   CASCADE   when child logically belongs to parent lifecycle (QUOTA, link rows).

BEGIN;

-- ============================================================================
-- plugin_audit_entries.plugin_id -> plugins(id)
-- Source: 059_create_plugin_tables.sql (column is nullable UUID)
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_audit_entries_plugin_id')
  THEN
    ALTER TABLE ONLY plugin_audit_entries
      ADD CONSTRAINT fk_plugin_audit_entries_plugin_id
      FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- ============================================================================
-- plugin_security_events.plugin_id -> plugins(id)
-- Source: 059_create_plugin_tables.sql (column is nullable UUID)
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_security_events_plugin_id')
  THEN
    ALTER TABLE ONLY plugin_security_events
      ADD CONSTRAINT fk_plugin_security_events_plugin_id
      FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- ============================================================================
-- plugin_resource_quotas.plugin_id -> plugins(id)
-- Source: 059_create_plugin_tables.sql (NOT NULL UUID, unique per plugin)
-- Quota row lifecycle follows plugin lifecycle -> CASCADE
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_plugin_resource_quotas_plugin_id')
  THEN
    ALTER TABLE ONLY plugin_resource_quotas
      ADD CONSTRAINT fk_plugin_resource_quotas_plugin_id
      FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- ============================================================================
-- library_versions.artifact_id -> artifacts(id)
-- Source: 051_create_internal_library_tables.sql (nullable UUID column)
-- Parent table: artifacts (012_create_artifact_tables.sql), NOT build_artifacts
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_library_versions_artifact_id')
  THEN
    ALTER TABLE ONLY library_versions
      ADD CONSTRAINT fk_library_versions_artifact_id
      FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- ============================================================================
-- problem_incident_links.incident_id -> incidents(id)
-- Source: 061_create_problem_tables.sql (incident_id UUID, link row)
-- Parent table: incidents (049_create_incident_tables.sql), NOT incident_incidents
-- Link row lifecycle follows incident lifecycle -> CASCADE
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_problem_incident_links_incident_id')
  THEN
    ALTER TABLE ONLY problem_incident_links
      ADD CONSTRAINT fk_problem_incident_links_incident_id
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- ============================================================================
-- tickets.sla_policy_id -> ticket_sla_policies(id)
-- Source: 002_ticketing_schema_fixes.sql (nullable UUID column added to tickets)
-- Parent table: ticket_sla_policies (076_create_ticketing_tables.sql)
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tickets_sla_policy_id')
  THEN
    ALTER TABLE ONLY tickets
      ADD CONSTRAINT fk_tickets_sla_policy_id
      FOREIGN KEY (sla_policy_id) REFERENCES ticket_sla_policies(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- ============================================================================
-- Validate all newly added constraints (safe to re-run: validates, skips existing)
-- ============================================================================
DO $$ BEGIN
  FOR conname IN SELECT conname FROM pg_constraint
    WHERE conname IN (
        'fk_plugin_audit_entries_plugin_id',
        'fk_plugin_security_events_plugin_id',
        'fk_plugin_resource_quotas_plugin_id',
        'fk_library_versions_artifact_id',
        'fk_problem_incident_links_incident_id',
        'fk_tickets_sla_policy_id'
    )
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', (SELECT relname FROM pg_constraint c JOIN pg_class r ON c.conrelid = r.oid WHERE c.conname = conname), conname);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not validate constraint %: %', conname, SQLERRM;
    END;
  END LOOP;
END $$;

COMMIT;
