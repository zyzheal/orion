-- Migration 324: Alert Breaker Rules (告警熔断引擎)
-- 告警熔断/去重/抑制规则

CREATE TABLE IF NOT EXISTS alert_breaker_rules (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    rule_type       TEXT NOT NULL DEFAULT 'dedup',
    conditions      JSONB NOT NULL DEFAULT '{}',
    action          TEXT NOT NULL DEFAULT 'suppress',
    window_seconds  INTEGER DEFAULT 300,
    threshold       INTEGER DEFAULT 3,
    cooldown_seconds INTEGER DEFAULT 600,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    priority        INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_alert_breaker_rules_tenant ON alert_breaker_rules(tenant_id);
CREATE INDEX idx_alert_breaker_rules_type ON alert_breaker_rules(rule_type);

ALTER TABLE alert_breaker_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_breaker_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY alert_breaker_rules_tenant_isolation ON alert_breaker_rules
    USING (tenant_id = current_setting('app.current_tenant_id', true));
