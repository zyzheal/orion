-- Migration 760: BI Scheduled Reports — 定时报表
CREATE TABLE IF NOT EXISTS bi_scheduled_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    report_id       UUID NOT NULL,
    name            TEXT NOT NULL,
    schedule_cron   TEXT NOT NULL,
    recipients      TEXT[] NOT NULL DEFAULT '{}',
    format          TEXT NOT NULL DEFAULT 'pdf',
    email_subject   TEXT,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    last_sent_at    TIMESTAMPTZ,
    next_send_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);
CREATE INDEX idx_bi_scheduled_reports_tenant ON bi_scheduled_reports(tenant_id, enabled);
