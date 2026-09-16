-- 653_create_terminal_audit_missing_tables.sql
-- terminal-audit 模块: terminal_audit_log 表无 CREATE TABLE。
-- 回滚见 653_create_terminal_audit_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS terminal_audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    user_id     UUID NOT NULL,
    command     TEXT NOT NULL,
    output      TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'success',
    host        TEXT NOT NULL DEFAULT '',
    ip          TEXT NOT NULL DEFAULT '',
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_terminal_audit_log_tenant ON terminal_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_terminal_audit_log_user ON terminal_audit_log(user_id);
