-- Migration 730: Create pipeline_artifacts table (ADR-014 §3.2.1)
-- 来源: docs/adr/ADR-014-Pipeline-ArtifactBus-方案.md §3.2.1
-- 目的: Pipeline ArtifactBus Phase 1 - 建立 pipeline 步骤间 artifact 持久化表
-- 兼容性: 新表, 不影响现有 pipeline_runs
-- 编号: 730 (预留号段, 与 Automation Bus 728-729 区分)
-- 回滚: 730_create_pipeline_artifacts_down.sql

BEGIN;

CREATE TABLE IF NOT EXISTS pipeline_artifacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    pipeline_run_id UUID NOT NULL,
    stage_id        UUID NOT NULL,
    name            TEXT NOT NULL,
    content_type    TEXT NOT NULL,
    size_bytes      BIGINT NOT NULL,
    content         BYTEA NOT NULL,
    checksum        TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    UNIQUE (pipeline_run_id, stage_id, name)
);

-- 按 pipeline_run 查所有 artifacts (ArtifactBus.List)
CREATE INDEX IF NOT EXISTS idx_pipeline_artifacts_run
    ON pipeline_artifacts (pipeline_run_id);

-- 按 (run, stage) 聚合 (ArtifactBus.Get 的可选优化)
CREATE INDEX IF NOT EXISTS idx_pipeline_artifacts_stage
    ON pipeline_artifacts (pipeline_run_id, stage_id);

-- 定期清理过期 artifact (ArtifactBus.Cleanup)
CREATE INDEX IF NOT EXISTS idx_pipeline_artifacts_expires
    ON pipeline_artifacts (expires_at);

-- 租户隔离 (ADR-0004)
CREATE INDEX IF NOT EXISTS idx_pipeline_artifacts_tenant
    ON pipeline_artifacts (tenant_id);

COMMENT ON TABLE pipeline_artifacts IS
    'Pipeline ArtifactBus (ADR-014 方案 B PG 持久化); step-to-step 二进制传递, 7天自动过期';

COMMENT ON COLUMN pipeline_artifacts.tenant_id IS
    '租户 ID (ADR-0004 共享库 + tenant_id 列过滤)';

COMMENT ON COLUMN pipeline_artifacts.pipeline_run_id IS
    '关联 pipeline_runs.id; 生命周期跟随 pipeline_run (run 结束后 artifacts 保留 7 天)';

COMMENT ON COLUMN pipeline_artifacts.checksum IS
    'SHA256(content), hex 编码; 用于下游 stage 校验传递完整性';

COMMENT ON COLUMN pipeline_artifacts.metadata IS
    'JSONB 扩展字段; stage 可放入 label 信息 (e.g. {"producer":"build","version":"1.2.3"})';

COMMENT ON COLUMN pipeline_artifacts.expires_at IS
    '默认 created_at + 7 days; ArtifactBus.Cleanup 定时 DELETE WHERE expires_at < NOW()';

COMMIT;
