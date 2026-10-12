-- Migration 729: DevOps Webhooks — 事件订阅
CREATE TABLE IF NOT EXISTS devops_webhooks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    url             TEXT NOT NULL,
    event_types     TEXT[] NOT NULL DEFAULT '{}',
    headers         JSONB NOT NULL DEFAULT '{}',
    secret          TEXT,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    last_delivery_at TIMESTAMPTZ,
    last_delivery_status TEXT,
    delivery_count  INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);
CREATE INDEX idx_devops_webhooks_tenant ON devops_webhooks(tenant_id, enabled);
