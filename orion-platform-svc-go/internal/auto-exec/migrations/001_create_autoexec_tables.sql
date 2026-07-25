-- auto-exec: core tables for the NeatLogic-style automation engine
-- Migration 001 — creates execution_tasks, execution_history, plugin_spi

CREATE TABLE IF NOT EXISTS execution_tasks (
    id              VARCHAR(64)  PRIMARY KEY,
    tenant_id       VARCHAR(64)  NOT NULL,
    name            VARCHAR(255) NOT NULL,
    type            VARCHAR(32)  NOT NULL,
    config          TEXT         DEFAULT '',
    plugin          VARCHAR(128) NOT NULL,
    plugin_params   TEXT         DEFAULT '{}',
    status          VARCHAR(16)  NOT NULL DEFAULT 'pending',
    retry_count     INT          NOT NULL DEFAULT 0,
    max_retries     INT          NOT NULL DEFAULT 3,
    timeout         INT          NOT NULL DEFAULT 300,
    output          TEXT         DEFAULT '',
    error           TEXT         DEFAULT '',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS execution_history (
    id          VARCHAR(64) PRIMARY KEY,
    task_id     VARCHAR(64) NOT NULL REFERENCES execution_tasks(id),
    action      VARCHAR(64) NOT NULL,
    result      TEXT,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_ms BIGINT
);

CREATE TABLE IF NOT EXISTS plugin_spi (
    id          VARCHAR(64) PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(128) NOT NULL,
    category    VARCHAR(32)  NOT NULL,
    description TEXT         DEFAULT '',
    params      JSONB        DEFAULT '{}',
    enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_tasks_tenant ON execution_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_execution_tasks_status ON execution_tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_execution_history_task ON execution_history(task_id);
CREATE INDEX IF NOT EXISTS idx_plugin_spi_name ON plugin_spi(name);
