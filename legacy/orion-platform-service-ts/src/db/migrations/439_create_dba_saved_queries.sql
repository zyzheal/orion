-- ============================================================================
-- Task 2.14: DBA Direct Query Execution - Saved Queries Table
-- ============================================================================
-- Stores user-saved query templates for the DBA direct query execution feature.
-- Supports parameterized query templates with per-tenant isolation.

-- Create table

CREATE TABLE IF NOT EXISTS dba_saved_queries (
    id              VARCHAR(36)   NOT NULL PRIMARY KEY,
    tenant_id       VARCHAR(36)   NOT NULL,
    user_id         VARCHAR(36)   NOT NULL,
    name            VARCHAR(255)  NOT NULL,
    sql             TEXT          NOT NULL,
    params           JSONB         DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes

CREATE INDEX IF NOT EXISTS idx_dba_saved_queries_tenant_id
    ON dba_saved_queries (tenant_id);

CREATE INDEX IF NOT EXISTS idx_dba_saved_queries_tenant_user
    ON dba_saved_queries (tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_dba_saved_queries_updated
    ON dba_saved_queries (updated_at DESC);

-- Unique constraint: one query name per user within a tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_dba_saved_queries_tenant_user_name
    ON dba_saved_queries (tenant_id, user_id, lower(name));

-- Trigger to auto-update updated_at

CREATE OR REPLACE FUNCTION update_dba_saved_queries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dba_saved_queries_updated_at ON dba_saved_queries;
CREATE TRIGGER trg_dba_saved_queries_updated_at
    BEFORE UPDATE ON dba_saved_queries
    FOR EACH ROW
    EXECUTE FUNCTION update_dba_saved_queries_updated_at();
