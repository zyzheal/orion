-- Migration 716: ITSM Service Catalog — 服务目录
CREATE TABLE IF NOT EXISTS itsm_services (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    description     TEXT,
    service_type    TEXT NOT NULL DEFAULT 'internal',
    -- internal, external, customer-facing
    owner_id        TEXT NOT NULL DEFAULT 'system',
    version         TEXT NOT NULL DEFAULT '1.0',
    status          TEXT NOT NULL DEFAULT 'active',
    sla_policy_id   UUID,
    tags            TEXT[] DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, slug)
);
CREATE INDEX idx_itsm_services_tenant ON itsm_services(tenant_id, status);
