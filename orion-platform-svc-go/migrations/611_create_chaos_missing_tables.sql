-- 611_create_chaos_missing_tables.sql
-- chaos 模块: chaos_experiments 表已由 110 创建但缺 4 列 (scope / faults / steady_state_hypothesis / auto_rollback)；
-- 其余 3 张表 (runs / injections / recoveries) 无 CREATE TABLE。
-- 回滚见 611_create_chaos_missing_tables_down.sql。

-- 1. 为已存在的 chaos_experiments 补齐 4 列。
ALTER TABLE chaos_experiments ADD COLUMN IF NOT EXISTS scope                   TEXT NOT NULL DEFAULT '';
ALTER TABLE chaos_experiments ADD COLUMN IF NOT EXISTS faults                  JSONB DEFAULT '[]';
ALTER TABLE chaos_experiments ADD COLUMN IF NOT EXISTS steady_state_hypothesis TEXT NOT NULL DEFAULT '';
ALTER TABLE chaos_experiments ADD COLUMN IF NOT EXISTS auto_rollback           BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. chaos_experiment_runs
CREATE TABLE IF NOT EXISTS chaos_experiment_runs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    experiment_id UUID NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    reason        TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chaos_experiment_runs_tenant ON chaos_experiment_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chaos_experiment_runs_experiment ON chaos_experiment_runs(experiment_id);

-- 3. chaos_injections
CREATE TABLE IF NOT EXISTS chaos_injections (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    experiment_id UUID NOT NULL,
    injection_id  TEXT NOT NULL DEFAULT '',
    fault_type    TEXT NOT NULL DEFAULT '',
    target        TEXT NOT NULL DEFAULT '',
    config_json   JSONB DEFAULT '{}',
    status        TEXT NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chaos_injections_tenant ON chaos_injections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chaos_injections_experiment ON chaos_injections(experiment_id);

-- 4. chaos_recoveries
CREATE TABLE IF NOT EXISTS chaos_recoveries (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    experiment_id UUID NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    message       TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chaos_recoveries_tenant ON chaos_recoveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chaos_recoveries_experiment ON chaos_recoveries(experiment_id);
