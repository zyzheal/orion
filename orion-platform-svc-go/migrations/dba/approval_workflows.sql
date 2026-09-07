-- Migration: 20260906000003 approval_workflows
-- Creates multi-stage approval tables for DBA orders.
-- Mirrors the layout used by internal/dba/approval/repository.go.

CREATE TABLE IF NOT EXISTS dba_approval_workflows (
    id          UUID PRIMARY KEY,
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    steps       JSONB NOT NULL DEFAULT '[]',
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dba_approval_workflows_tenant
    ON dba_approval_workflows (tenant_id);

CREATE TABLE IF NOT EXISTS dba_approval_instances (
    id             UUID PRIMARY KEY,
    tenant_id      UUID NOT NULL,
    order_id       TEXT NOT NULL,
    workflow_id    UUID NOT NULL,
    workflow_name  TEXT,
    current_step   INTEGER NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'pending',
    steps          JSONB NOT NULL DEFAULT '[]',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dba_approval_instances_order
    ON dba_approval_instances (order_id);

CREATE INDEX IF NOT EXISTS idx_dba_approval_instances_tenant
    ON dba_approval_instances (tenant_id);

CREATE TABLE IF NOT EXISTS dba_approval_records (
    id          UUID PRIMARY KEY,
    instance_id UUID NOT NULL,
    step_index  INTEGER NOT NULL,
    user_id     TEXT NOT NULL,
    action      TEXT NOT NULL,
    comment     TEXT,
    actioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dba_approval_records_instance
    ON dba_approval_records (instance_id);
