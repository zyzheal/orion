-- 665_create_pipeline_templates_missing_tables.sql
-- pipeline-templates 模块: template_versions 表无 CREATE TABLE。
-- 注: pipeline_templates 主表已由 160 创建, 591 补了 10 列 DEFAULT; 此模块只缺子表 template_versions。
-- 回滚见 665_create_pipeline_templates_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS template_versions (
    id           UUID PRIMARY KEY,
    template_id  UUID NOT NULL,
    version      TEXT NOT NULL,
    config       JSONB DEFAULT '{}',
    parameters   JSONB DEFAULT '[]',
    change_log   TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_template_versions_template ON template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_version ON template_versions(version);
