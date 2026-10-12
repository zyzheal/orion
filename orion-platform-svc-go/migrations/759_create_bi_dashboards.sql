-- Migration 759: BI Dashboards — 仪表板布局定义
CREATE TABLE IF NOT EXISTS bi_dashboards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    layout          JSONB NOT NULL DEFAULT '{}',
    widgets         JSONB NOT NULL DEFAULT '[]',
    refresh_interval INTEGER NOT NULL DEFAULT 300,
    shared          BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      TEXT NOT NULL DEFAULT 'system',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);
CREATE INDEX idx_bi_dashboards_tenant ON bi_dashboards(tenant_id);
