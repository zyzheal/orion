-- Migration 770: Platform Audit Log — 平台审计日志
CREATE TABLE IF NOT EXISTS platform_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    actor_id        TEXT NOT NULL,
    action          TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    resource_id     TEXT NOT NULL,
    details         JSONB NOT NULL DEFAULT '{}',
    ip_address      TEXT,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_platform_audit_log_actor ON platform_audit_log(tenant_id, actor_id, created_at DESC);
CREATE INDEX idx_platform_audit_log_resource ON platform_audit_log(tenant_id, resource_type, resource_id);
