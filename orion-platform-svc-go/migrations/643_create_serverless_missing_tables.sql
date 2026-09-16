-- 643_create_serverless_missing_tables.sql
-- serverless 模块: serverless_function_metrics 表无 CREATE TABLE。
-- 用 (tenant_id, function_id) 复合主键 (ON CONFLICT upsert 模式)。
-- 回滚见 643_create_serverless_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS serverless_function_metrics (
    tenant_id         UUID NOT NULL,
    function_id       UUID NOT NULL,
    invocations       BIGINT NOT NULL DEFAULT 0,
    avg_duration_ms   DOUBLE PRECISION NOT NULL DEFAULT 0,
    error_count       BIGINT NOT NULL DEFAULT 0,
    error_rate        DOUBLE PRECISION NOT NULL DEFAULT 0,
    memory_usage_mb   INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, function_id)
);
