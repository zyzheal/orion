-- 679_create_dba_osc_jobs_table.sql
-- Promotes migrations/dba/osc_jobs.sql to the flat migrations/ directory.
-- LoadMigrations skips subdirectories, so the original file was never
-- executed. internal/dba/osc/repository.go queries dba_osc_jobs and would
-- fail with "relation does not exist".
--
-- Fixed: the original declared a `table` column without quotes. `table` is
-- a SQL reserved word and the original would have failed with a syntax error
-- even if it had been loaded. Wrapped in double quotes.
-- Rollback: 679_create_dba_osc_jobs_table_down.sql.

CREATE TABLE IF NOT EXISTS dba_osc_jobs (
    id                  TEXT PRIMARY KEY,
    tenant_id           TEXT NOT NULL,
    user_id             TEXT NOT NULL DEFAULT '',
    data_source_id      TEXT NOT NULL,
    "table"             TEXT NOT NULL,
    alter_sql           TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending',
    dry_run             BOOLEAN NOT NULL DEFAULT FALSE,
    cutover_mode        TEXT NOT NULL DEFAULT 'atomic',
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
