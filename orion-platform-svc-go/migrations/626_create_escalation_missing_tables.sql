-- 626_create_escalation_missing_tables.sql
-- escalation 模块: escalation_event 表无 CREATE TABLE。
-- 回滚见 626_create_escalation_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS escalation_event (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id    UUID NOT NULL,
    message    TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_escalation_event_rule ON escalation_event(rule_id);
