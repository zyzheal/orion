-- Migration 717: ITSM Catalog Request — 目录请求表单
CREATE TABLE IF NOT EXISTS itsm_catalog_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    service_id      UUID NOT NULL REFERENCES itsm_services(id) ON DELETE CASCADE,
    requester_id    TEXT NOT NULL,
    form_data       JSONB NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'submitted',
    -- submitted, approved, fulfilled, rejected, cancelled
    approval_id     UUID,
    notes           TEXT,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fulfilled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_itsm_catalog_requests_service ON itsm_catalog_requests(service_id);
CREATE INDEX idx_itsm_catalog_requests_status ON itsm_catalog_requests(tenant_id, status);
