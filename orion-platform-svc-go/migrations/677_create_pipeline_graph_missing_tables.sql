-- 677_create_pipeline_graph_missing_tables.sql
-- pipeline-graph 模块: pipeline_definitions 表无 CREATE TABLE。
-- 注: pipeline_graph.go 的注释声称 Migration 572 已建, 但 grep 验证迁移目录无此定义,
-- SELECT * FROM pipeline_definitions 会因 relation does not exist 失败。
-- 列取自 repository.go 的 PipelineDefinition struct db tag。
-- 回滚见 677_create_pipeline_graph_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS pipeline_definitions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    name         TEXT NOT NULL,
    yaml_content TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'active',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_definitions_tenant ON pipeline_definitions(tenant_id);
