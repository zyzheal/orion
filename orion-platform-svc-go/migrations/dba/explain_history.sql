-- Migration: 20260907000002 explain_history
-- Stores historical EXPLAIN results for audit and trend analysis.
-- Plans can be several KB so we keep the raw text; the parsed tree
-- is regenerated on demand.

CREATE TABLE IF NOT EXISTS dba_explain_history (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    data_source_id  TEXT NOT NULL,
    db_type         TEXT NOT NULL,              -- 'postgres' | 'mysql'
    sql             TEXT NOT NULL,
    plan_text       TEXT NOT NULL,
    passed          BOOLEAN NOT NULL DEFAULT FALSE,
    duration_ms     BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dba_explain_tenant_created
    ON dba_explain_history (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dba_explain_ds_created
    ON dba_explain_history (data_source_id, created_at DESC);
