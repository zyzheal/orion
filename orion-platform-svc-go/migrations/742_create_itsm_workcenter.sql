-- Migration 742: ITSM Workcenter — 工作中心模块
CREATE TABLE IF NOT EXISTS itsm_workcenters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    manager_id      TEXT,
    skill_required  JSONB NOT NULL DEFAULT '[]',
    capacity        INTEGER NOT NULL DEFAULT 10,
    current_load    INTEGER NOT NULL DEFAULT 0,
    priority_order  TEXT NOT NULL DEFAULT 'round_robin',
    status          TEXT NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);
CREATE INDEX idx_itsm_workcenters_tenant ON itsm_workcenters(tenant_id, status);
