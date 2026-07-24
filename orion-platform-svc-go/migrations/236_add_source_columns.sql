-- Migration 236: Add _source column for dual-write conflict prevention
-- Adds _source TEXT column to key shared tables. Default is 'ts' so legacy
-- rows (written by the TS monolith before this migration) are treated as
-- owned by TS. The Go service tags every write with _source='go'.
--
-- Non-breaking: existing rows without _source automatically become 'ts'.

-- tickets (Ticketing module)
ALTER TABLE IF EXISTS tickets
    ADD COLUMN IF NOT EXISTS _source TEXT DEFAULT 'ts' NOT NULL;

-- pipeline_runs (Pipeline engine)
ALTER TABLE IF EXISTS pipeline_runs
    ADD COLUMN IF NOT EXISTS _source TEXT DEFAULT 'ts' NOT NULL;

-- approvals (Approval workflow)
ALTER TABLE IF EXISTS approvals
    ADD COLUMN IF NOT EXISTS _source TEXT DEFAULT 'ts' NOT NULL;

-- feature_flags
ALTER TABLE IF EXISTS feature_flags
    ADD COLUMN IF NOT EXISTS _source TEXT DEFAULT 'ts' NOT NULL;

-- workflow_instances
ALTER TABLE IF EXISTS workflow_instances
    ADD COLUMN IF NOT EXISTS _source TEXT DEFAULT 'ts' NOT NULL;

-- audit_logs
ALTER TABLE IF EXISTS audit_logs
    ADD COLUMN IF NOT EXISTS _source TEXT DEFAULT 'ts' NOT NULL;

-- slo (SLO/SLI)
ALTER TABLE IF EXISTS slo
    ADD COLUMN IF NOT EXISTS _source TEXT DEFAULT 'ts' NOT NULL;

-- alert
ALTER TABLE IF EXISTS alert
    ADD COLUMN IF NOT EXISTS _source TEXT DEFAULT 'ts' NOT NULL;

-- Optional: additional high-traffic shared tables

-- change_requests
ALTER TABLE IF EXISTS change_requests
    ADD COLUMN IF NOT EXISTS _source TEXT DEFAULT 'ts' NOT NULL;

-- notifications
ALTER TABLE IF EXISTS notifications
    ADD COLUMN IF NOT EXISTS _source TEXT DEFAULT 'ts' NOT NULL;

-- webhooks
ALTER TABLE IF EXISTS webhooks
    ADD COLUMN IF NOT EXISTS _source TEXT DEFAULT 'ts' NOT NULL;

-- index for fast source-based queries
CREATE INDEX IF NOT EXISTS idx_tickets_source ON tickets(_source);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_source ON pipeline_runs(_source);
CREATE INDEX IF NOT EXISTS idx_approvals_source ON approvals(_source);
