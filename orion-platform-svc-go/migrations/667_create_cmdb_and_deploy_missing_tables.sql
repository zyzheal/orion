-- 667_create_cmdb_and_deploy_missing_tables.sql
-- 3 个模块: cmdb-import / cmdb-validator / deployment-trigger。
-- cmdb_attribute_values 由 cmdb-validator 查询引用 (无 INSERT, SELECT JOIN cmdb_cis)。
-- 回滚见 667_create_cmdb_and_deploy_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS cmdb_import_jobs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    name          TEXT NOT NULL,
    source_type   TEXT NOT NULL DEFAULT '',
    source_path   TEXT NOT NULL DEFAULT '',
    target_type   TEXT NOT NULL DEFAULT '',
    mapping       JSONB DEFAULT '{}',
    mode          TEXT NOT NULL DEFAULT 'create',
    status        TEXT NOT NULL DEFAULT 'pending',
    total_count   INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    error_count   INTEGER NOT NULL DEFAULT 0,
    error         TEXT NOT NULL DEFAULT '',
    started_at    TIMESTAMPTZ,
    finished_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmdb_import_jobs_tenant ON cmdb_import_jobs(tenant_id);

CREATE TABLE IF NOT EXISTS cmdb_import_records (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id      UUID NOT NULL,
    source_row  TEXT NOT NULL DEFAULT '',
    target_id   UUID,
    action      TEXT NOT NULL DEFAULT '',
    error       TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmdb_import_records_job ON cmdb_import_records(job_id);

-- cmdb_attribute_values: EAV 风格 (Entity-Attribute-Value)，每行一个 CI 属性值。
-- cmdb-validator 通过 JOIN cmdb_cis 查询，需要 ci_id/tenant_id/attribute_id/value 列。
CREATE TABLE IF NOT EXISTS cmdb_attribute_values (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    ci_id         TEXT NOT NULL,
    attribute_id  TEXT NOT NULL,
    value         TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmdb_attribute_values_tenant ON cmdb_attribute_values(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_attribute_values_ci ON cmdb_attribute_values(ci_id);

CREATE TABLE IF NOT EXISTS trigger_executions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id      UUID NOT NULL,
    tenant_id       UUID NOT NULL,
    triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status          TEXT NOT NULL DEFAULT 'pending',
    pipeline_run_id UUID,
    error           TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trigger_executions_trigger ON trigger_executions(trigger_id);
CREATE INDEX IF NOT EXISTS idx_trigger_executions_tenant ON trigger_executions(tenant_id);
