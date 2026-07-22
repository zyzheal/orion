-- Migration 135: Artifact Version Tracking and Traceability (GAP-CN-06)
-- 为制品添加版本化管理和从代码->构建->部署的追溯链能力

-- 制品版本追踪表：每次 PipelineRun 产出的制品版本记录
CREATE TABLE IF NOT EXISTS artifact_version_tracking (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id    UUID NOT NULL,
  run_id         UUID NOT NULL,
  stage_name     VARCHAR(200) NOT NULL,
  artifact_name  VARCHAR(200) NOT NULL,
  version        VARCHAR(100) NOT NULL,
  commit_sha     VARCHAR(40),
  branch         VARCHAR(200),
  metadata       JSONB NOT NULL DEFAULT '{}',
  storage_path   TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引：按 Pipeline 和版本查询（版本溯源的核心查询路径）
CREATE INDEX idx_artifact_version_tracking_pipeline_version
  ON artifact_version_tracking(pipeline_id, version);

-- 索引：按 Run ID 查询（运行时追溯）
CREATE INDEX idx_artifact_version_tracking_run_id
  ON artifact_version_tracking(run_id);

-- 索引：按 Commit SHA 查询（代码溯源）
CREATE INDEX idx_artifact_version_tracking_commit_sha
  ON artifact_version_tracking(commit_sha)
  WHERE commit_sha IS NOT NULL;

-- 索引：按租户 + 分支查询
CREATE INDEX idx_artifact_version_tracking_tenant_branch
  ON artifact_version_tracking(tenant_id, branch)
  WHERE branch IS NOT NULL;

-- 回滚：
-- DROP INDEX IF EXISTS idx_artifact_version_tracking_tenant_branch;
-- DROP INDEX IF EXISTS idx_artifact_version_tracking_commit_sha;
-- DROP INDEX IF EXISTS idx_artifact_version_tracking_run_id;
-- DROP INDEX IF EXISTS idx_artifact_version_tracking_pipeline_version;
-- DROP TABLE IF EXISTS artifact_version_tracking;
