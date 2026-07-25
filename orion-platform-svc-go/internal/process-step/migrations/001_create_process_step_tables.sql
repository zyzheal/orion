-- process-step: workflow step engine tables for approval/process lifecycle management
-- Migration 001 — creates process_steps, process_step_executions, process_step_events

CREATE TABLE IF NOT EXISTS process_steps (
    id              VARCHAR(64)  PRIMARY KEY,
    tenant_id       VARCHAR(64)  NOT NULL,
    process_id      VARCHAR(64)  NOT NULL DEFAULT '',
    name            VARCHAR(255) NOT NULL,
    step_type       VARCHAR(32)  NOT NULL DEFAULT 'approval',
    "order"         INTEGER      NOT NULL DEFAULT 0,
    handler_type    VARCHAR(128) NOT NULL DEFAULT '',
    config          JSONB        DEFAULT '{}',
    status          VARCHAR(16)  NOT NULL DEFAULT 'ready',
    assignee        VARCHAR(128) DEFAULT '',
    assignee_type   VARCHAR(16)  NOT NULL DEFAULT 'user',
    timeout         INTEGER      NOT NULL DEFAULT 0,
    enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
    error           TEXT         DEFAULT '',
    description     TEXT         DEFAULT '',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS process_step_executions (
    id              VARCHAR(64)  PRIMARY KEY,
    step_id         VARCHAR(64)  NOT NULL REFERENCES process_steps(id) ON DELETE CASCADE,
    instance_id     VARCHAR(64)  NOT NULL,
    input           JSONB        DEFAULT '{}',
    output          JSONB        DEFAULT '{}',
    status          VARCHAR(16)  NOT NULL DEFAULT 'pending',
    started_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ  DEFAULT NULL,
    duration_ms     BIGINT       NOT NULL DEFAULT 0,
    error           TEXT         DEFAULT '',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS process_step_events (
    id              VARCHAR(64)  PRIMARY KEY,
    step_id         VARCHAR(64)  NOT NULL REFERENCES process_steps(id) ON DELETE CASCADE,
    event_type      VARCHAR(32)  NOT NULL,
    details         JSONB        DEFAULT '{}',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_process_steps_tenant ON process_steps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_process_steps_process ON process_steps(tenant_id, process_id);
CREATE INDEX IF NOT EXISTS idx_process_steps_type ON process_steps(step_type);
CREATE INDEX IF NOT EXISTS idx_process_steps_status ON process_steps(status);
CREATE INDEX IF NOT EXISTS idx_process_steps_order ON process_steps(process_id, "order");
CREATE INDEX IF NOT EXISTS idx_process_step_executions_step ON process_step_executions(step_id);
CREATE INDEX IF NOT EXISTS idx_process_step_executions_instance ON process_step_executions(instance_id);
CREATE INDEX IF NOT EXISTS idx_process_step_executions_status ON process_step_executions(status);
CREATE INDEX IF NOT EXISTS idx_process_step_events_step ON process_step_events(step_id);
CREATE INDEX IF NOT EXISTS idx_process_step_events_type ON process_step_events(event_type);
