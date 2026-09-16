-- 630_create_mcp_missing_tables.sql
-- mcp 模块: mcp_server / mcp_tool 2 张表无 CREATE TABLE。
-- 回滚见 630_create_mcp_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS mcp_server (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL,
    url        TEXT NOT NULL,
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mcp_server_tenant ON mcp_server(tenant_id);

CREATE TABLE IF NOT EXISTS mcp_tool (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id  UUID NOT NULL,
    name       TEXT NOT NULL,
    params     JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_server ON mcp_tool(server_id);
