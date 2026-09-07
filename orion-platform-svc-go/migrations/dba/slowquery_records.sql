-- Migration: 20260907000001 slowquery_records
-- Stores collected slow-query rows from PostgreSQL (pg_stat_statements)
-- and MySQL (performance_schema.events_statements_summary_by_digest).
--
-- The (data_source_id, query_hash) unique key lets the collector's
-- ON CONFLICT clause accumulate call_count/total_time_ms across
-- repeated collection passes instead of duplicating rows.

CREATE TABLE IF NOT EXISTS dba_slowquery_records (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    data_source_id  TEXT NOT NULL,
    db_type         TEXT NOT NULL,              -- 'postgres' | 'mysql'
    schema          TEXT NOT NULL DEFAULT '',
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

-- Collector dedup key
CREATE UNIQUE INDEX IF NOT EXISTS idx_dba_slowquery_ds_hash
    ON dba_slowquery_records (data_source_id, query_hash);

-- Top-N hot path: order by total_time_ms DESC with optional since filter.
CREATE INDEX IF NOT EXISTS idx_dba_slowquery_ds_time
    ON dba_slowquery_records (data_source_id, total_time_ms DESC, collected_at);

-- Retention-prune path
CREATE INDEX IF NOT EXISTS idx_dba_slowquery_collected_at
    ON dba_slowquery_records (collected_at);

-- Tenant scoping
CREATE INDEX IF NOT EXISTS idx_dba_slowquery_tenant
    ON dba_slowquery_records (tenant_id);
