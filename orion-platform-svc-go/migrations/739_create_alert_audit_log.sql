-- Migration 739: Alert Audit Log — 告警操作审计日志
CREATE TABLE IF NOT EXISTS alert_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    alert_id        UUID,
    action          TEXT NOT NULL,
    -- triggered, acknowledged, silenced, escalated, resolved, correlated
    actor_id        TEXT NOT NULL DEFAULT 'system',
    details         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alert_audit_log_alert ON alert_audit_log(alert_id);
CREATE INDEX idx_alert_audit_log_action ON alert_audit_log(tenant_id, action, created_at DESC);
CREATE INDEX idx_alert_audit_log_created ON alert_audit_log(tenant_id, created_at DESC);
