-- 591_pipeline_templates_defaults.sql
-- 给 pipeline_templates 的 NOT NULL 列补默认值，解锁两个模块的 INSERT。
-- 回滚见 591_pipeline_templates_defaults_down.sql（同名编号的 _down.sql，
-- 与 160/161/586/587/588 的 up+down 同编号配对惯例一致）。
--
-- 背景：migrations/160 在 CREATE TABLE 之后用
--   ALTER TABLE ... ADD COLUMN ... NOT NULL
-- 追加了 10 个 NOT NULL 列，既没有 DEFAULT，也没有给存量行填值。结果是
-- 任何只按各自模型的列集合写入 pipeline_templates 的 INSERT 都会因为缺列而失败：
--
--   - internal/pipeline-template（单数模块）的 INSERT 只写 11 列，缺
--     display_name / status / visibility / author / config / parameters /
--     usage_count / star_count → "null value in column display_name violates
--     not-null constraint"。
--
--   - internal/pipeline-templates（复数模块）的 INSERT 写 20 列，但它的模型
--     里没有 YamlDefinition 字段（grep 零命中），且 service.Create 也不填它，
--     而 yaml_definition 同样是 NOT NULL 无默认值 → "null value in column
--     yaml_definition violates not-null constraint"。
--
-- 即：两个模块的模板创建在数据库层从来无法成功。本迁移用 COLUMN_DEFAULT
-- 让缺列写入时由数据库兜底，而不是改两个模块的模型和 INSERT 列列表去互相迁就。
--
-- 默认值取值依据 internal/pipeline-templates/service/service.go 的 Create：
--   StatusDraft = "draft"、VisibilityPrivate = "private"、
--   Version "1.0.0"、Config/Parameters/Tags 均为 JSON 空集 "{}" / "[]"。
-- 因此这些默认值与复数模块 service 层已有的行为一致，不会引入语义偏移。
--
-- 用 ALTER COLUMN ... SET DEFAULT 而非 DROP NOT NULL，保留原有约束强度：
-- 调用方仍然可以显式传值覆盖，只是不再因为漏传而 500。

ALTER TABLE pipeline_templates ALTER COLUMN yaml_definition SET DEFAULT '';
ALTER TABLE pipeline_templates ALTER COLUMN tags          SET DEFAULT '[]';
ALTER TABLE pipeline_templates ALTER COLUMN display_name  SET DEFAULT '';
ALTER TABLE pipeline_templates ALTER COLUMN status        SET DEFAULT 'draft';
ALTER TABLE pipeline_templates ALTER COLUMN visibility    SET DEFAULT 'private';
ALTER TABLE pipeline_templates ALTER COLUMN author        SET DEFAULT '';
ALTER TABLE pipeline_templates ALTER COLUMN config        SET DEFAULT '{}';
ALTER TABLE pipeline_templates ALTER COLUMN parameters    SET DEFAULT '[]';
ALTER TABLE pipeline_templates ALTER COLUMN usage_count   SET DEFAULT 0;
ALTER TABLE pipeline_templates ALTER COLUMN star_count    SET DEFAULT 0;
