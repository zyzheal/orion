-- Migration 712: SLA Exception — 临时豁免策略
-- 允许特定工单临时豁免 SLA（需审批）

CREATE TABLE IF NOT EXISTS itsm_sla_exceptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    policy_id       UUID NOT NULL REFERENCES itsm_sla_policies(id) ON DELETE CASCADE,
    ticket_id       UUID NOT NULL,
    reason          TEXT NOT NULL,
    requested_by    TEXT NOT NULL,
    approved_by     TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    -- Statuses: pending, approved, rejected, expired
    valid_from      TIMESTAMPTZ NOT NULL,
    valid_until     TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_itsm_sla_exceptions_ticket ON itsm_sla_exceptions(tenant_id, ticket_id);
CREATE INDEX idx_itsm_sla_exceptions_policy ON itsm_sla_exceptions(tenant_id, policy_id);
