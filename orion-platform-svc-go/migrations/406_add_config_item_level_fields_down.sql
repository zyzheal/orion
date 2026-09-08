-- Phase 302 T-CONFIG-LEVEL: 回滚三层覆盖字段。
-- 注意：down 迁移会丢失层级信息；仅用于回退开发环境，禁止在生产环境执行。

ALTER TABLE config_item
    DROP INDEX idx_level,
    DROP INDEX idx_override_of,
    DROP COLUMN level,
    DROP COLUMN override_of,
    DROP COLUMN priority;
