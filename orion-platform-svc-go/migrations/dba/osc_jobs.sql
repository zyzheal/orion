-- Migration: dba_osc_jobs
-- Created: 2026-09-06
-- Purpose: Persists Online Schema Change jobs executed via gh-ost.
--
-- The row record is intentionally narrow: credentials live in
-- dba_data_sources and are resolved at job start time so secret
-- rotation applies to jobs created before they run.

CREATE TABLE IF NOT EXISTS dba_osc_jobs (
    id                  TEXT PRIMARY KEY,
    tenant_id           TEXT NOT NULL,
    user_id             TEXT NOT NULL DEFAULT '',
    data_source_id      TEXT NOT NULL,
    table               TEXT NOT NULL,
    alter_sql           TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending',
    -- pending / running / completed / failed / cancelled
    dry_run             BOOLEAN NOT NULL DEFAULT FALSE,
    cutover_mode        TEXT NOT NULL DEFAULT 'atomic',
    -- two-step / atomic / instant
    max_lag_millis      INTEGER NOT NULL DEFAULT 1500,
    chunk_size          INTEGER NOT NULL DEFAULT 1000,
    error_message       TEXT,
    log                 TEXT NOT NULL DEFAULT '',
    rows_affected       BIGINT,
    max_lag_observed    BIGINT,
    duration_ms         BIGINT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at          TIMESTAMPTZ,
    finished_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dba_osc_jobs_tenant     ON dba_osc_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dba_osc_jobs_status     ON dba_osc_jobs(status);
CREATE INDEX IF NOT EXISTS idx_dba_osc_jobs_tenant_created ON dba_osc_jobs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dba_osc_jobs_datasource ON dba_osc_jobs(data_source_id);

-- Rollback (kept inline for parity with sibling migrations):
--   DROP INDEX IF EXISTS idx_dba_osc_jobs_tenant_created;
--   DROP INDEX IF EXISTS idx_dba_osc_jobs_datasource;
--   DROP INDEX IF EXISTS idx_dba_osc_jobs_status;
--   DROP INDEX IF EXISTS idx_dba_osc_jobs_tenant;
--   DROP TABLE IF EXISTS dba_osc_jobs;
