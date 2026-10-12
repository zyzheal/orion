-- Migration 713: Escalation Matrix — 升级矩阵
-- 定义 SLA 违约时的升级路径

CREATE TABLE IF NOT EXISTS itsm_escalation_matrices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    -- Escalation levels: [{level, delay_seconds, target_type, target_id, action}]
    levels          JSONB NOT NULL DEFAULT '[]',
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX idx_itsm_escalation_matrices_tenant ON itsm_escalation_matrices(tenant_id);
