-- 633_create_multi_cloud_missing_tables.sql
-- multi-cloud 模块: scheduling_history 表无 CREATE TABLE。
-- 回滚见 633_create_multi_cloud_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS scheduling_history (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    policy_id     UUID NOT NULL,
    decision      JSONB DEFAULT '{}',
    decision_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduling_history_tenant ON scheduling_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_history_policy ON scheduling_history(policy_id);
