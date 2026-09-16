-- 646_create_resilience_score_missing_tables.sql
-- resilience-score 模块: resilience_score_history / resilience_service_scores 2 张表无 CREATE TABLE。
-- resilience_service_scores 用 (tenant_id, service_name) 复合主键 (ON CONFLICT upsert 模式)。
-- 回滚见 646_create_resilience_score_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS resilience_score_history (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    overall_score    DOUBLE PRECISION NOT NULL DEFAULT 0,
    level            TEXT NOT NULL DEFAULT '',
    component_scores JSONB DEFAULT '{}',
    trigger          TEXT NOT NULL DEFAULT '',
    details          TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_resilience_score_history_tenant ON resilience_score_history(tenant_id);

CREATE TABLE IF NOT EXISTS resilience_service_scores (
    tenant_id        UUID NOT NULL,
    service_name     TEXT NOT NULL,
    overall_score    DOUBLE PRECISION NOT NULL DEFAULT 0,
    level            TEXT NOT NULL DEFAULT '',
    components       JSONB DEFAULT '{}',
    dependencies     JSONB DEFAULT '{}',
    incidents        JSONB DEFAULT '{}',
    last_assessment  TIMESTAMPTZ,
    PRIMARY KEY (tenant_id, service_name)
);
