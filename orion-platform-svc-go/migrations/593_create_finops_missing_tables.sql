-- 593_create_finops_missing_tables.sql
-- FinOps 模块 7 张表无 CREATE TABLE：repository 的 INSERT 全部失败
-- "pq: relation "finops_budgets" does not exist"。
--
-- migrations/041 只建了 3 张（budget_guards / anomalies / cost_items），
-- 但 repository 还往另外 7 张表写数据。grep 确认无任何迁移创建过它们：
--   finops_billing_records, finops_budgets, finops_cost_comparisons,
--   finops_cost_records, finops_optimizations, finops_roi_analyses,
--   finops_usage_records。
--
-- 列列表取自 repository 的 INSERT INTO 列列表，类型推断自 model db tag
-- 和 041 既有表的风格（UUID + gen_random_uuid, TIMESTAMPTZ DEFAULT NOW()）。
-- DEFAULT 兜底与 591 同理：调用方可显式传值覆盖，只是不再因漏传而 500。
-- 回滚见 593_create_finops_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS finops_billing_records (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    billing_period TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'draft',
    total_amount   DECIMAL(18,2) NOT NULL DEFAULT 0,
    paid_amount    DECIMAL(18,2) NOT NULL DEFAULT 0,
    due_date       TIMESTAMPTZ,
    items          JSONB DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finops_billing_records_tenant ON finops_billing_records(tenant_id);

CREATE TABLE IF NOT EXISTS finops_budgets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    entity_type TEXT NOT NULL DEFAULT '',
    entity_id   TEXT NOT NULL DEFAULT '',
    amount      DECIMAL(18,2) NOT NULL DEFAULT 0,
    period      TEXT NOT NULL DEFAULT '',
    currency    TEXT NOT NULL DEFAULT 'USD',
    alerts      JSONB DEFAULT '[]',
    environment TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finops_budgets_tenant ON finops_budgets(tenant_id);

CREATE TABLE IF NOT EXISTS finops_cost_comparisons (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    description       TEXT NOT NULL DEFAULT '',
    before_cost       DECIMAL(18,2) NOT NULL DEFAULT 0,
    after_cost        DECIMAL(18,2) NOT NULL DEFAULT 0,
    savings           DECIMAL(18,2) NOT NULL DEFAULT 0,
    savings_percent   DECIMAL(5,2) NOT NULL DEFAULT 0,
    time_savings_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
    period            TEXT NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finops_cost_comparisons_tenant ON finops_cost_comparisons(tenant_id);

CREATE TABLE IF NOT EXISTS finops_cost_records (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    entity_type TEXT NOT NULL DEFAULT '',
    entity_id   TEXT NOT NULL DEFAULT '',
    amount      DECIMAL(18,2) NOT NULL DEFAULT 0,
    category    TEXT NOT NULL DEFAULT '',
    currency    TEXT NOT NULL DEFAULT 'USD',
    environment TEXT NOT NULL DEFAULT '',
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finops_cost_records_tenant ON finops_cost_records(tenant_id);

CREATE TABLE IF NOT EXISTS finops_optimizations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    service          TEXT NOT NULL DEFAULT '',
    category         TEXT NOT NULL DEFAULT '',
    description      TEXT NOT NULL DEFAULT '',
    potential_savings DECIMAL(18,2) NOT NULL DEFAULT 0,
    priority         TEXT NOT NULL DEFAULT 'medium',
    entity_id        TEXT NOT NULL DEFAULT '',
    entity_type      TEXT NOT NULL DEFAULT '',
    resource_ids     JSONB DEFAULT '[]',
    notes            TEXT NOT NULL DEFAULT '',
    effort           TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'open',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finops_optimizations_tenant ON finops_optimizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_finops_optimizations_status ON finops_optimizations(tenant_id, status);

CREATE TABLE IF NOT EXISTS finops_roi_analyses (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    investment_type TEXT NOT NULL DEFAULT '',
    name           TEXT NOT NULL DEFAULT '',
    cost           DECIMAL(18,2) NOT NULL DEFAULT 0,
    savings        DECIMAL(18,2) NOT NULL DEFAULT 0,
    period         TEXT NOT NULL DEFAULT '',
    roi_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    payback_months DECIMAL(10,2) NOT NULL DEFAULT 0,
    description    TEXT NOT NULL DEFAULT '',
    details        JSONB DEFAULT '{}',
    analyzed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finops_roi_analyses_tenant ON finops_roi_analyses(tenant_id);

CREATE TABLE IF NOT EXISTS finops_usage_records (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    service      TEXT NOT NULL DEFAULT '',
    metric       TEXT NOT NULL DEFAULT '',
    quantity     DECIMAL(18,4) NOT NULL DEFAULT 0,
    unit_price   DECIMAL(18,4) NOT NULL DEFAULT 0,
    total_cost   DECIMAL(18,2) NOT NULL DEFAULT 0,
    period_start TIMESTAMPTZ,
    period_end   TIMESTAMPTZ,
    metadata     JSONB DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finops_usage_records_tenant ON finops_usage_records(tenant_id);
