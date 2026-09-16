-- 624_create_import_export_missing_tables.sql
-- import-export 模块: import_export_jobs / import_export_errors 2 张表无 CREATE TABLE。
-- 回滚见 624_create_import_export_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS import_export_jobs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    user_id       UUID,
    data_type     TEXT NOT NULL,
    operation     TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    format        TEXT NOT NULL DEFAULT 'json',
    source_name   TEXT NOT NULL DEFAULT '',
    output_name   TEXT NOT NULL DEFAULT '',
    error_count   INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    total_count   INTEGER NOT NULL DEFAULT 0,
    progress      INTEGER NOT NULL DEFAULT 0,
    progress_msg  TEXT NOT NULL DEFAULT '',
    message       TEXT NOT NULL DEFAULT '',
    metadata      JSONB DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_import_export_jobs_tenant ON import_export_jobs(tenant_id);

CREATE TABLE IF NOT EXISTS import_export_errors (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id      UUID NOT NULL,
    row_number  INTEGER NOT NULL DEFAULT 0,
    field       TEXT NOT NULL DEFAULT '',
    message     TEXT NOT NULL DEFAULT '',
    raw_value   TEXT NOT NULL DEFAULT '',
    error_type  TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_import_export_errors_job ON import_export_errors(job_id);
