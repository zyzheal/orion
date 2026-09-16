-- 603_create_dba_missing_tables.sql
-- dba 模块 4 张表无 CREATE TABLE。
-- dba_sql_orders INSERT 9 列，但 model 有 result/executed_at/approved_by/approved_at —— 留给已有迁移或将来扩展。
-- 这里只覆盖 INSERT 9 列 + dba_data_sources / dba_audit_rules / dba_query_audit_log。
-- 回滚见 603_create_dba_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS dba_sql_orders (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    user_id       TEXT NOT NULL DEFAULT '',
    database_name TEXT NOT NULL DEFAULT '',
    sql_text      TEXT NOT NULL DEFAULT '',
    comment       TEXT NOT NULL DEFAULT '',
    order_type    TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dba_sql_orders_tenant ON dba_sql_orders(tenant_id);

CREATE TABLE IF NOT EXISTS dba_data_sources (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    name          TEXT NOT NULL DEFAULT '',
    source_type   TEXT NOT NULL DEFAULT '',
    host          TEXT NOT NULL DEFAULT '',
    port          INTEGER NOT NULL DEFAULT 0,
    database_name TEXT NOT NULL DEFAULT '',
    username      TEXT NOT NULL DEFAULT '',
    password      TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dba_data_sources_tenant ON dba_data_sources(tenant_id);

CREATE TABLE IF NOT EXISTS dba_audit_rules (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name      TEXT NOT NULL DEFAULT '',
    pattern   TEXT NOT NULL DEFAULT '',
    severity  TEXT NOT NULL DEFAULT 'medium',
    enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dba_audit_rules_tenant ON dba_audit_rules(tenant_id);

CREATE TABLE IF NOT EXISTS dba_query_audit_log (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    user_id          TEXT NOT NULL DEFAULT '',
    data_source_id   UUID,
    data_source_name TEXT NOT NULL DEFAULT '',
    sql_text         TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT '',
    row_count        INTEGER NOT NULL DEFAULT 0,
    latency_ms       INTEGER NOT NULL DEFAULT 0,
    error_message    TEXT NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dba_query_audit_log_tenant ON dba_query_audit_log(tenant_id);
