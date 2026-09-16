-- 680_create_dba_explain_history_table.sql
-- Promotes migrations/dba/explain_history.sql to the flat migrations/ directory.
-- LoadMigrations skips subdirectories, so the original file was never
-- executed. internal/dba/explain/repository.go queries dba_explain_history
-- and would fail with "relation does not exist".
-- Rollback: 680_create_dba_explain_history_table_down.sql.

CREATE TABLE IF NOT EXISTS dba_explain_history (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    data_source_id  TEXT NOT NULL,
    db_type         TEXT NOT NULL,
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
