-- 620_create_chaos_gateway_missing_tables.sql
-- chaos-gateway 模块: chaos_experiment_logs / chaos_experiment_results 2 张表无 CREATE TABLE。
-- 注: 110_create_chaos-gateway_tables.sql 已建 experiment_logs / experiment_results（短名），
-- 但代码实际引用的是 chaos_ 前缀的长名（命名不一致的潜在遗留 bug），
-- 此处按代码实际引用的长名建表，不改动 110 的短名表。
-- 回滚见 620_create_chaos_gateway_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS chaos_experiment_results (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id       TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'running',
    start_time          BIGINT,
    end_time            BIGINT,
    duration            BIGINT NOT NULL DEFAULT 0,
    metrics             JSONB DEFAULT '{}',
    impacted_targets    JSONB DEFAULT '[]',
    recovery_time       BIGINT NOT NULL DEFAULT 0,
    detection_time      BIGINT NOT NULL DEFAULT 0,
    insights            TEXT NOT NULL DEFAULT '',
    recommendations     TEXT NOT NULL DEFAULT '',
    tenant_id           UUID NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chaos_experiment_results_experiment ON chaos_experiment_results(experiment_id);
CREATE INDEX IF NOT EXISTS idx_chaos_experiment_results_tenant ON chaos_experiment_results(tenant_id);

CREATE TABLE IF NOT EXISTS chaos_experiment_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id TEXT NOT NULL,
    timestamp     BIGINT NOT NULL,
    level         TEXT NOT NULL DEFAULT 'info',
    message       TEXT NOT NULL,
    details       TEXT NOT NULL DEFAULT '',
    tenant_id     UUID NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chaos_experiment_logs_experiment ON chaos_experiment_logs(experiment_id);
CREATE INDEX IF NOT EXISTS idx_chaos_experiment_logs_tenant ON chaos_experiment_logs(tenant_id);
