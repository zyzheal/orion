-- Migration 333: Report Definitions + Schedules (报表设计器)
-- 报表定义与调度

CREATE TABLE IF NOT EXISTS report_definitions (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    report_type     TEXT NOT NULL DEFAULT 'table',
    data_source     JSONB NOT NULL DEFAULT '{}',
    columns         JSONB NOT NULL DEFAULT '[]',
    filters         JSONB NOT NULL DEFAULT '{}',
    layout          JSONB NOT NULL DEFAULT '{}',
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_report_definitions_tenant ON report_definitions(tenant_id);

ALTER TABLE report_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY report_definitions_tenant_isolation ON report_definitions
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE TABLE IF NOT EXISTS report_schedules (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    report_id       TEXT NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
    cron_expression TEXT NOT NULL,
    format          TEXT NOT NULL DEFAULT 'pdf',
    recipients      JSONB NOT NULL DEFAULT '[]',
    enabled         BOOLEAN NOT NULL DEFAULT true,
    last_run_at     TIMESTAMPTZ,
    next_run_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_schedules_tenant ON report_schedules(tenant_id);
CREATE INDEX idx_report_schedules_report ON report_schedules(report_id);

ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_schedules FORCE ROW LEVEL SECURITY;
CREATE POLICY report_schedules_tenant_isolation ON report_schedules
    USING (tenant_id = current_setting('app.current_tenant_id', true));
