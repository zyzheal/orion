-- 641_create_rule_engine_missing_tables.sql
-- rule-engine 模块: rules 表无 CREATE TABLE。
-- 回滚见 641_create_rule_engine_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS rules (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    priority     INTEGER NOT NULL DEFAULT 0,
    conditions   JSONB DEFAULT '{}',
    actions      JSONB DEFAULT '[]',
    is_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rules_tenant ON rules(tenant_id);
