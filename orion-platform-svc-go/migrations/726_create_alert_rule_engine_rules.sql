-- Migration 726: Alert Rule Engine Rules — 规则引擎持久化

CREATE TABLE IF NOT EXISTS alert_rule_engine_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    query           TEXT NOT NULL,
    -- PromQL/AlertQL expression
    condition       TEXT NOT NULL DEFAULT '>',
    -- Conditions: >, >=, <, <=, ==, !=
    threshold       DOUBLE PRECISION NOT NULL DEFAULT 0,
    for_duration    INTEGER NOT NULL DEFAULT 60,
    labels          JSONB NOT NULL DEFAULT '{}',
    annotations     JSONB NOT NULL DEFAULT '{}',
    priority        INTEGER NOT NULL DEFAULT 5,
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    evaluation_count BIGINT NOT NULL DEFAULT 0,
    last_evaluated  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX idx_alert_rule_engine_rules_tenant ON alert_rule_engine_rules(tenant_id, is_enabled);
CREATE INDEX idx_alert_rule_engine_rules_priority ON alert_rule_engine_rules(tenant_id, priority);
