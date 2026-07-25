-- Migration: create job_action tables
-- Module: orion-platform-svc-go/internal/job-actions
-- Description: Tables for reusable job actions and their execution history.
--              42 action types across 6 categories (deployment, infrastructure,
--              data, notification, admin, monitoring).

-- job_actions: the action definition registry
CREATE TABLE IF NOT EXISTS job_actions (
    id          VARCHAR(64) PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    type        VARCHAR(64)  NOT NULL,
    description TEXT         DEFAULT '',
    params      TEXT         DEFAULT '{}',
    category    VARCHAR(32)  NOT NULL DEFAULT 'deployment',
    timeout     INT          NOT NULL DEFAULT 300,
    retry_count INT          NOT NULL DEFAULT 0,
    enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- job_action_executions: per-run audit trail
CREATE TABLE IF NOT EXISTS job_action_executions (
    id          VARCHAR(64)  PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL,
    action_id   VARCHAR(64)  NOT NULL REFERENCES job_actions(id),
    params      TEXT         DEFAULT '{}',
    status      VARCHAR(16)  NOT NULL DEFAULT 'pending',
    output      TEXT         DEFAULT '',
    error       TEXT         DEFAULT '',
    duration_ms BIGINT       NOT NULL DEFAULT 0,
    started_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_job_actions_tenant ON job_actions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_actions_type ON job_actions(type);
CREATE INDEX IF NOT EXISTS idx_job_actions_category ON job_actions(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_job_action_executions_action ON job_action_executions(action_id);
CREATE INDEX IF NOT EXISTS idx_job_action_executions_tenant ON job_action_executions(tenant_id);
