-- Migration 719: ITSM Work Notes — 工单工作记录
CREATE TABLE IF NOT EXISTS itsm_work_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    ticket_id       UUID NOT NULL,
    author_id       TEXT NOT NULL,
    content         TEXT NOT NULL,
    note_type       TEXT NOT NULL DEFAULT 'internal',
    -- internal, customer, system
    is_solution     BOOLEAN NOT NULL DEFAULT FALSE,
    attachments     JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_itsm_work_notes_ticket ON itsm_work_notes(ticket_id, created_at DESC);
CREATE INDEX idx_itsm_work_notes_author ON itsm_work_notes(tenant_id, author_id);
