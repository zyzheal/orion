-- 672_create_progressive_and_scheduled_missing_tables.sql
-- 2 个模块: progressive / scheduled-notification。
-- 回滚见 672_create_progressive_and_scheduled_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS progressive_deployments (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL,
    name                        TEXT NOT NULL,
    service_name                TEXT NOT NULL,
    strategy                    TEXT NOT NULL DEFAULT 'linear',
    current_stage               INTEGER NOT NULL DEFAULT 0,
    total_stages                INTEGER NOT NULL DEFAULT 1,
    status                      TEXT NOT NULL DEFAULT 'pending',
    health_check_endpoint       TEXT NOT NULL DEFAULT '',
    health_check_interval_seconds INTEGER NOT NULL DEFAULT 30,
    rollback_threshold          INTEGER NOT NULL DEFAULT 10,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_progressive_deployments_tenant ON progressive_deployments(tenant_id);

CREATE TABLE IF NOT EXISTS rollout_stages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id   UUID NOT NULL,
    stage_number    INTEGER NOT NULL DEFAULT 0,
    traffic_percent INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending',
    health_metrics  JSONB DEFAULT '{}',
    error           TEXT NOT NULL DEFAULT '',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rollout_stages_deployment ON rollout_stages(deployment_id);

CREATE TABLE IF NOT EXISTS scheduled_notification_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id     UUID NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    error_message   TEXT NOT NULL DEFAULT '',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_notification_logs_schedule ON scheduled_notification_logs(schedule_id);
