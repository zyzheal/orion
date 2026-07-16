-- Migration 314: Fix timestamp type and enable RLS
-- for SLA (312) and Change Management (313) tables
--
-- P0 fixes from architecture review 2026-06-24:
-- 1. TIMESTAMP → TIMESTAMPTZ (timezone-aware timestamps)
-- 2. Enable RLS (row-level security) for multi-tenant isolation
--
-- NOTE: tenant_id type (VARCHAR(64) → UUID) deferred — 39 source files
-- use 'default' as fallback tenant_id. Type change requires code-layer
-- refactor first (see architecture-review-2026-06-24.md P0-1).

-- ============================================================
-- Step 1: Convert TIMESTAMP → TIMESTAMPTZ
-- ============================================================

-- SLA tables
ALTER TABLE sla_definitions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE sla_definitions ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE sla_tracking ALTER COLUMN start_time TYPE TIMESTAMPTZ USING start_time AT TIME ZONE 'UTC';
ALTER TABLE sla_tracking ALTER COLUMN target_time TYPE TIMESTAMPTZ USING target_time AT TIME ZONE 'UTC';
ALTER TABLE sla_tracking ALTER COLUMN actual_time TYPE TIMESTAMPTZ USING actual_time AT TIME ZONE 'UTC';
ALTER TABLE sla_tracking ALTER COLUMN breach_time TYPE TIMESTAMPTZ USING breach_time AT TIME ZONE 'UTC';
ALTER TABLE sla_tracking ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE sla_tracking ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE sla_breach_events ALTER COLUMN event_time TYPE TIMESTAMPTZ USING event_time AT TIME ZONE 'UTC';
ALTER TABLE sla_breach_events ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Change Management tables
ALTER TABLE change_requests ALTER COLUMN scheduled_start TYPE TIMESTAMPTZ USING scheduled_start AT TIME ZONE 'UTC';
ALTER TABLE change_requests ALTER COLUMN scheduled_end TYPE TIMESTAMPTZ USING scheduled_end AT TIME ZONE 'UTC';
ALTER TABLE change_requests ALTER COLUMN actual_start TYPE TIMESTAMPTZ USING actual_start AT TIME ZONE 'UTC';
ALTER TABLE change_requests ALTER COLUMN actual_end TYPE TIMESTAMPTZ USING actual_end AT TIME ZONE 'UTC';
ALTER TABLE change_requests ALTER COLUMN approved_at TYPE TIMESTAMPTZ USING approved_at AT TIME ZONE 'UTC';
ALTER TABLE change_requests ALTER COLUMN rejected_at TYPE TIMESTAMPTZ USING rejected_at AT TIME ZONE 'UTC';
ALTER TABLE change_requests ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE change_requests ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE cab_meetings ALTER COLUMN scheduled_at TYPE TIMESTAMPTZ USING scheduled_at AT TIME ZONE 'UTC';
ALTER TABLE cab_meetings ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE cab_meetings ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE change_timeline ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

ALTER TABLE rfcs ALTER COLUMN reviewed_at TYPE TIMESTAMPTZ USING reviewed_at AT TIME ZONE 'UTC';
ALTER TABLE rfcs ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE rfcs ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- ============================================================
-- Step 2: Enable RLS (Row Level Security)
-- ============================================================
-- Pattern matches migration 073 and 127

-- SLA tables
ALTER TABLE sla_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_sla_definitions ON sla_definitions
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id'));

ALTER TABLE sla_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_tracking FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_sla_tracking ON sla_tracking
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id'));

ALTER TABLE sla_breach_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_breach_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_sla_breach_events ON sla_breach_events
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id'));

-- Change Management tables
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_change_requests ON change_requests
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id'));

ALTER TABLE cab_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cab_meetings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_cab_meetings ON cab_meetings
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id'));

ALTER TABLE change_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_timeline FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_change_timeline ON change_timeline
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id'));

ALTER TABLE rfcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfcs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_rfcs ON rfcs
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id'));

-- ============================================================
-- Migration complete
-- ============================================================
-- Summary:
--   7 tables: TIMESTAMP → TIMESTAMPTZ (25 columns)
--   7 tables: RLS enabled
--   tenant_id type change: DEFERRED (requires code refactor, 39 files use 'default' fallback)
