-- 664_create_pipeline_budget_missing_tables.sql
-- pipeline-budget 模块: pipeline_budgets / pipeline_budget_history 2 张表无 CREATE TABLE。
-- pipeline_budgets 用 (pipeline_id, tenant_id) 复合主键 (ON CONFLICT upsert 模式)。
-- 注: "type" 列名是 SQL 保留字, 用引号包裹。
-- 回滚见 664_create_pipeline_budget_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS pipeline_budgets (
    id           UUID PRIMARY KEY,
    pipeline_id  UUID NOT NULL,
    tenant_id    UUID NOT NULL,
    "type"       TEXT NOT NULL DEFAULT '',
    period       TEXT NOT NULL DEFAULT 'month',
    limits       JSONB DEFAULT '{}',
    cost_limits  JSONB DEFAULT '{}',
    alerts       JSONB DEFAULT '[]',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_budgets_pipeline ON pipeline_budgets(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_budgets_tenant ON pipeline_budgets(tenant_id);

CREATE TABLE IF NOT EXISTS pipeline_budget_history (
    id           UUID PRIMARY KEY,
    pipeline_id  UUID NOT NULL,
    tenant_id    UUID NOT NULL,
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action       TEXT NOT NULL DEFAULT '',
    details      TEXT NOT NULL DEFAULT '',
    actor        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_pipeline_budget_history_pipeline ON pipeline_budget_history(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_budget_history_tenant ON pipeline_budget_history(tenant_id);
