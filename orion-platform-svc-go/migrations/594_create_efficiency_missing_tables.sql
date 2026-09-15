-- 594_create_efficiency_missing_tables.sql
-- Efficiency 模块 6 张表无 CREATE TABLE，repository INSERT 全部失败。
--
-- repository 把 model 序列化成 JSONB 存储在 *_data 列，INSERT 列列表只
-- 有 4-8 列（id / tenant_id / *_data / 时间戳）。
-- 回滚见 594_create_efficiency_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS efficiency_global_deployments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    deployment_data JSONB NOT NULL DEFAULT '{}',
    deployed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_efficiency_global_deployments_tenant ON efficiency_global_deployments(tenant_id);

CREATE TABLE IF NOT EXISTS efficiency_global_pipelines (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    pipeline_data JSONB NOT NULL DEFAULT '{}',
    completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_efficiency_global_pipelines_tenant ON efficiency_global_pipelines(tenant_id);

CREATE TABLE IF NOT EXISTS efficiency_metric_snapshots (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL,
    time_window          TEXT NOT NULL DEFAULT '',
    deployment_frequency DECIMAL(10,2) NOT NULL DEFAULT 0,
    lead_time_ms         BIGINT NOT NULL DEFAULT 0,
    change_failure_rate  DECIMAL(5,2) NOT NULL DEFAULT 0,
    mttr_ms              BIGINT NOT NULL DEFAULT 0,
    captured_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_efficiency_metric_snapshots_tenant ON efficiency_metric_snapshots(tenant_id);

CREATE TABLE IF NOT EXISTS efficiency_project_data (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    pipelines   INTEGER NOT NULL DEFAULT 0,
    deployments INTEGER NOT NULL DEFAULT 0,
    commits     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_efficiency_project_data_tenant ON efficiency_project_data(tenant_id);

CREATE TABLE IF NOT EXISTS efficiency_report_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    report_data JSONB NOT NULL DEFAULT '{}',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_efficiency_report_history_tenant ON efficiency_report_history(tenant_id);

CREATE TABLE IF NOT EXISTS efficiency_team_data (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    members     INTEGER NOT NULL DEFAULT 0,
    pipelines   INTEGER NOT NULL DEFAULT 0,
    deployments INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_efficiency_team_data_tenant ON efficiency_team_data(tenant_id);
