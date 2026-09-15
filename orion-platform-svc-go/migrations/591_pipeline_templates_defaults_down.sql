-- 591_pipeline_templates_defaults_down.sql
-- Reverse 591_pipeline_templates_defaults.sql.

-- 591 用 ALTER COLUMN ... SET DEFAULT 给 10 个 NOT NULL 列补了默认值。回滚
-- 只是把默认值抹掉（DROP DEFAULT），不需要也不应该移除列本身或解除 NOT NULL
-- 约束：160 引入时这些列就是 NOT NULL，抹掉默认值会立刻让两个模块的 INSERT
-- 重新因为缺列而失败，这正是 591 要修的问题。

ALTER TABLE pipeline_templates ALTER COLUMN yaml_definition DROP DEFAULT;
ALTER TABLE pipeline_templates ALTER COLUMN tags          DROP DEFAULT;
ALTER TABLE pipeline_templates ALTER COLUMN display_name  DROP DEFAULT;
ALTER TABLE pipeline_templates ALTER COLUMN status        DROP DEFAULT;
ALTER TABLE pipeline_templates ALTER COLUMN visibility    DROP DEFAULT;
ALTER TABLE pipeline_templates ALTER COLUMN author        DROP DEFAULT;
ALTER TABLE pipeline_templates ALTER COLUMN config        DROP DEFAULT;
ALTER TABLE pipeline_templates ALTER COLUMN parameters    DROP DEFAULT;
ALTER TABLE pipeline_templates ALTER COLUMN usage_count   DROP DEFAULT;
ALTER TABLE pipeline_templates ALTER COLUMN star_count    DROP DEFAULT;
