-- Migration 718: ITSM Approval Workflow — 多级审批流
CREATE TABLE IF NOT EXISTS itsm_approval_steps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    ticket_id       UUID NOT NULL,
    approver_id     TEXT NOT NULL,
    step_order      INTEGER NOT NULL DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'pending',
    -- pending, approved, rejected, skipped
    comment         TEXT,
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, ticket_id, approver_id, step_order)
);
CREATE INDEX idx_itsm_approval_steps_ticket ON itsm_approval_steps(ticket_id);
CREATE INDEX idx_itsm_approval_steps_approver ON itsm_approval_steps(tenant_id, approver_id, status);
