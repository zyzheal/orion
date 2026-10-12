-- Migration 711: SLA Break — 记录 SLA 违约事件
-- 当响应/解决时间超过策略定义时自动记录

CREATE TABLE IF NOT EXISTS itsm_sla_breaks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    policy_id       UUID NOT NULL REFERENCES itsm_sla_policies(id) ON DELETE CASCADE,
    ticket_id       UUID,
    break_type      TEXT NOT NULL,
    -- Types: response_timeout, resolve_timeout
    breached_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actual_duration INTERVAL,
    allowed_duration INTERVAL NOT NULL,
    overage_seconds BIGINT NOT NULL,
    acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_itsm_sla_breaks_policy ON itsm_sla_breaks(tenant_id, policy_id);
CREATE INDEX idx_itsm_sla_breaks_ticket ON itsm_sla_breaks(tenant_id, ticket_id);
CREATE INDEX idx_itsm_sla_breaks_type ON itsm_sla_breaks(tenant_id, break_type);
