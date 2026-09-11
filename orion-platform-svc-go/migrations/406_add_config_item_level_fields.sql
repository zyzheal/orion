-- Phase 302 T-CONFIG-LEVEL: 三层覆盖（platform / tenant / user）
-- 为 config_item 增加 Level 字段以支持优先级合并。
--
-- 优先级：platform(100) > tenant(50) > user(10)
-- 向后兼容：既有数据默认 level='tenant', priority=50（与旧行为等价）。
-- override_of 指向被覆盖的上层 item ID；NULL 表示该行不是 override。

ALTER TABLE config_item
    ADD COLUMN level VARCHAR(20) NOT NULL DEFAULT 'tenant',
    ADD COLUMN override_of VARCHAR(36) DEFAULT NULL,
    ADD COLUMN priority INT NOT NULL DEFAULT 50;

-- PostgreSQL 不支持 ALTER TABLE ... ADD INDEX；拆成独立 CREATE INDEX。
CREATE INDEX IF NOT EXISTS idx_config_item_level ON config_item(level);
CREATE INDEX IF NOT EXISTS idx_config_item_override_of ON config_item(override_of);
