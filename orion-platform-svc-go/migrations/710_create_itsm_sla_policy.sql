-- Migration 710: ITSM SLA Policy — 策略管理层
-- 5 concepts: SLAPolicy, SLABreak, SLAException, EscalationMatrix, SLAConfig

-- SLA Policy: 定义 SLA 策略模板
CREATE TABLE IF NOT EXISTS itsm_sla_policies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    service_id      UUID,
    priority_order  TEXT NOT NULL DEFAULT 'P1',
    response_time   INTERVAL NOT NULL,
    resolve_time    INTERVAL NOT NULL,
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    calendar        TEXT NOT NULL DEFAULT 'standard',
    status          TEXT NOT NULL DEFAULT 'active',
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX idx_itsm_sla_policies_tenant ON itsm_sla_policies(tenant_id, status);
CREATE INDEX idx_itsm_sla_policies_service ON itsm_sla_policies(tenant_id, service_id);
