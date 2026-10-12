-- Migration 714: SLA Config — SLA 全局配置
-- 默认策略 + 自动计算开关 + 违约告警阈值

CREATE TABLE IF NOT EXISTS itsm_sla_config (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               TEXT NOT NULL,
    auto_calculate          BOOLEAN NOT NULL DEFAULT TRUE,
    default_policy_id       UUID,
    break_alert_threshold   BIGINT NOT NULL DEFAULT 5,
    break_alert_cooldown    INTERVAL NOT NULL DEFAULT INTERVAL '1 hour',
    escalation_auto         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id)
);
