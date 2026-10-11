-- Migration 731: Add artifact_count to pipeline_runs (ADR-014 §3.2.1 可选)
-- 来源: docs/adr/ADR-014-Pipeline-ArtifactBus-方案.md §3.2.1
-- 目的: 让 pipeline_runs 直接可读 "本次运行产生了多少 artifacts", 避免每次都 JOIN 计数
-- 兼容性: ALTER TABLE ADD COLUMN IF NOT EXISTS + NOT NULL + DEFAULT 0
--   - 新 run 创建时 service 层填充; 老 run 保留 0 (未产生 artifact)
-- 编号: 731 (紧邻 730, 表依赖)
-- 回滚: 731_pipeline_runs_add_artifact_count_down.sql

BEGIN;

ALTER TABLE pipeline_runs
    ADD COLUMN IF NOT EXISTS artifact_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN pipeline_runs.artifact_count IS
    '本次 pipeline run 产生的 artifact 总数; 由 Pipeline Executor 在 run 结束时 UPDATE; 0 = 未产生 artifact';

COMMIT;
