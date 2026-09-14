-- Runbook module schema alignment.
--
-- internal/runbook is fully wired (wireRunbook runs on every boot and seven
-- routes are registered under /runbooks), but its repository and its DDL
-- describe two different tables, so every endpoint failed before business
-- logic ran.
--
-- 172_create_runbook_tables.sql is an unrelated, earlier schema for a table
-- named runbooks:
--     id, tenant_id, name NOT NULL, value NOT NULL, enabled, metadata,
--     created_at, updated_at, deleted_at
-- The repository INSERTs
--     id, tenant_id, title, description, category, severity, steps, tags,
--     owner, approved, enabled, created_at, updated_at
-- so eight of the thirteen columns it writes do not exist, and it never
-- supplies name or value, both of which are NOT NULL without a default. Any
-- write returned "column ... does not exist", or "null value in column name
-- violates not-null constraint" once the unknown columns were tolerated.
--
-- runbook_executions and runbook_execution_steps are written and read by the
-- repository and referenced by repository.Delete, but no migration creates
-- them at all. repository.EnsureTable contains the correct DDL for all three
-- tables, but nothing in cmd/server calls it, so the module silently depended
-- on 172.
--
-- tenant_id is UUID because 239_unify_tenant_id_to_uuid.sql has already
-- converted runbooks.tenant_id to UUID.
--
-- cmd/server/migration_runbook_tables_test.go pins this closure.

-- ---------------------------------------------------------------------------
-- Relax the two NOT NULL columns the runbook repository never supplies. They
-- are left in place because dropping them would invalidate any external reader.
-- ---------------------------------------------------------------------------

ALTER TABLE runbooks ALTER COLUMN name DROP NOT NULL;
ALTER TABLE runbooks ALTER COLUMN value DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- The eight columns the repository writes that 172 never declared.
-- ---------------------------------------------------------------------------

ALTER TABLE runbooks ADD COLUMN IF NOT EXISTS title       VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE runbooks ADD COLUMN IF NOT EXISTS description TEXT         DEFAULT '';
ALTER TABLE runbooks ADD COLUMN IF NOT EXISTS category    VARCHAR(64)  DEFAULT '';
ALTER TABLE runbooks ADD COLUMN IF NOT EXISTS severity    VARCHAR(32)  DEFAULT 'medium';
ALTER TABLE runbooks ADD COLUMN IF NOT EXISTS steps       JSONB        DEFAULT '[]';
ALTER TABLE runbooks ADD COLUMN IF NOT EXISTS tags        JSONB        DEFAULT '[]';
ALTER TABLE runbooks ADD COLUMN IF NOT EXISTS owner       VARCHAR(128) DEFAULT '';
ALTER TABLE runbooks ADD COLUMN IF NOT EXISTS approved    BOOLEAN      DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- Executions and per-step results.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS runbook_executions (
    id           UUID        PRIMARY KEY,
    tenant_id    UUID        NOT NULL,
    runbook_id   UUID        NOT NULL,
    incident_id  UUID,
    executor_id  VARCHAR(128) DEFAULT '',
    status       VARCHAR(32) DEFAULT 'pending',
    started_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runbook_executions_tenant ON runbook_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_runbook_executions_runbook ON runbook_executions(runbook_id);
CREATE INDEX IF NOT EXISTS idx_runbook_executions_started ON runbook_executions(tenant_id, runbook_id, started_at DESC);

CREATE TABLE IF NOT EXISTS runbook_execution_steps (
    id           UUID        PRIMARY KEY,
    execution_id UUID        NOT NULL,
    step_order   INTEGER     NOT NULL,
    status       VARCHAR(32) DEFAULT 'pending',
    output       TEXT        DEFAULT '',
    started_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (execution_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_runbook_execution_steps_execution ON runbook_execution_steps(execution_id);
