-- visor-exec (script execution on hosts) module tables.
--
-- The module is fully wired -- wireVisorExec runs on every boot and 28 routes
-- are registered under /visor-exec -- but every one of its endpoints failed at
-- runtime with
--   pq: relation "visor_exec_command_logs" does not exist
-- before any business logic could run.
--
-- 078_create_visor_exec_tables.sql is the intended DDL, but it creates the
-- unprefixed names (command_logs, cron_jobs, script_templates, cron_job_logs,
-- upload_tasks). Renaming the Go code back to those names is not an option:
-- internal/cron writes cron_jobs with a completely different column set
-- (schedule, task, description, status) into the same relation, so the two
-- modules would corrupt each other. The visor_exec_ prefix in the code is the
-- correct namespacing decision; the DDL was simply never written.
--
-- The column lists below are taken from the repository's INSERT and UPDATE
-- statements, because sqlx's NamedExecContext refuses a column the DDL does not
-- declare. cmd/server/migration_visor_exec_tables_test.go pins the closure.

-- ---------------------------------------------------------------------------
-- Command execution log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS visor_exec_command_logs (
    id          VARCHAR(64) PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT '',
    command     TEXT        NOT NULL,
    host_ids    TEXT,
    host_count  INTEGER     NOT NULL DEFAULT 0,
    timeout     INTEGER     NOT NULL DEFAULT 30,
    status      VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visor_exec_command_logs_tenant ON visor_exec_command_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visor_exec_command_logs_status ON visor_exec_command_logs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_visor_exec_command_logs_created ON visor_exec_command_logs(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS visor_exec_command_log_details (
    id           VARCHAR(64) PRIMARY KEY,
    tenant_id    VARCHAR(64) NOT NULL DEFAULT '',
    command_id   VARCHAR(64) NOT NULL,
    hostname     VARCHAR(255) NOT NULL,
    output       TEXT,
    error_output TEXT,
    exit_code    INTEGER NOT NULL DEFAULT 0,
    status       VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visor_exec_details_tenant ON visor_exec_command_log_details(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visor_exec_details_command ON visor_exec_command_log_details(tenant_id, command_id);
CREATE INDEX IF NOT EXISTS idx_visor_exec_details_hostname ON visor_exec_command_log_details(hostname);

-- ---------------------------------------------------------------------------
-- Script templates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS visor_exec_templates (
    id          VARCHAR(64) PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT '',
    name        VARCHAR(255) NOT NULL,
    description TEXT         NOT NULL DEFAULT '',
    content     TEXT         NOT NULL,
    category    VARCHAR(100) NOT NULL DEFAULT 'general',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visor_exec_templates_tenant ON visor_exec_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visor_exec_templates_category ON visor_exec_templates(tenant_id, category);

-- ---------------------------------------------------------------------------
-- Cron jobs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS visor_exec_cron_jobs (
    id             VARCHAR(64) PRIMARY KEY,
    tenant_id      VARCHAR(64)  NOT NULL DEFAULT '',
    name           VARCHAR(255) NOT NULL,
    command        TEXT         NOT NULL,
    host_ids       TEXT,
    hostnames      TEXT,
    cron_expression VARCHAR(255) NOT NULL,
    enabled        BOOLEAN      NOT NULL DEFAULT TRUE,
    last_run_at    TIMESTAMPTZ,
    next_run_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visor_exec_cron_jobs_tenant ON visor_exec_cron_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visor_exec_cron_jobs_enabled ON visor_exec_cron_jobs(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_visor_exec_cron_jobs_next ON visor_exec_cron_jobs(next_run_at);

CREATE TABLE IF NOT EXISTS visor_exec_cron_job_logs (
    id         VARCHAR(64) PRIMARY KEY,
    tenant_id  VARCHAR(64) NOT NULL DEFAULT '',
    job_id     VARCHAR(64) NOT NULL,
    command_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visor_exec_cron_job_logs_tenant ON visor_exec_cron_job_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visor_exec_cron_job_logs_job ON visor_exec_cron_job_logs(tenant_id, job_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Upload tasks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS visor_exec_upload_tasks (
    id          VARCHAR(64) PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT '',
    file_name   VARCHAR(255) NOT NULL,
    file_size   BIGINT NOT NULL DEFAULT 0,
    host_ids    TEXT,
    hostnames   TEXT,
    target_path VARCHAR(512) NOT NULL,
    status      VARCHAR(50) NOT NULL DEFAULT 'pending',
    progress    INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visor_exec_upload_tasks_tenant ON visor_exec_upload_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visor_exec_upload_tasks_status ON visor_exec_upload_tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_visor_exec_upload_tasks_created ON visor_exec_upload_tasks(tenant_id, created_at DESC);
