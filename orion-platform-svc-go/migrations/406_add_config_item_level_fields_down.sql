-- Phase 302 T-CONFIG-LEVEL: 回滚三层覆盖字段。
-- 注意：down 迁移会丢失层级信息；仅用于回退开发环境，禁止在生产环境执行。
-- Fixed: index names in down (idx_level/idx_override_of) did not match up (idx_config_item_level/idx_config_item_override_of).

DROP INDEX IF EXISTS idx_config_item_level;
DROP INDEX IF EXISTS idx_config_item_override_of;

ALTER TABLE config_item
    DROP COLUMN IF EXISTS level,
    DROP COLUMN IF EXISTS override_of,
    DROP COLUMN IF EXISTS priority;
