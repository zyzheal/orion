-- 681_create_dba_slowquery_records_table.sql
-- Promotes migrations/dba/slowquery_records.sql to the flat migrations/
-- directory. LoadMigrations skips subdirectories, so the original file was
-- never executed. internal/dba/slowquery/repository.go queries
-- dba_slowquery_records and would fail with "relation does not exist".
--
-- Fixed: the original declared a `schema` column without quotes. `schema`
-- is a SQL reserved word and the original would have failed with a syntax
-- error even if it had been loaded. Wrapped in double quotes.
-- Rollback: 681_create_dba_slowquery_records_table_down.sql.

CREATE TABLE IF NOT EXISTS dba_slowquery_records (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    data_source_id  TEXT NOT NULL,
    db_type         TEXT NOT NULL,
    "schema"        TEXT NOT NULL DEFAULT '',
    query           TEXT NOT NULL,
    query_hash      TEXT NOT NULL,
    call_count      BIGINT NOT NULL DEFAULT 0,
    mean_time_ms    NUMERIC NOT NULL DEFAULT 0,
    total_time_ms   NUMERIC NOT NULL DEFAULT 0,
    rows_read       BIGINT NOT NULL DEFAULT 0,
    rows_returned   BIGINT NOT NULL DEFAULT 0,
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dba_slowquery_ds_hash
    ON dba_slowquery_records (data_source_id, query_hash);

CREATE INDEX IF NOT EXISTS idx_dba_slowquery_ds_time
    ON dba_slowquery_records (data_source_id, total_time_ms DESC, collected_at);

CREATE INDEX IF NOT EXISTS idx_dba_slowquery_collected_at
    ON dba_slowquery_records (collected_at);

CREATE INDEX IF NOT EXISTS idx_dba_slowquery_tenant
    ON dba_slowquery_records (tenant_id);
