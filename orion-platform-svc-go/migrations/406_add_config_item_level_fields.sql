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

ALTER TABLE config_item
    ADD INDEX idx_level (level),
    ADD INDEX idx_override_of (override_of);
