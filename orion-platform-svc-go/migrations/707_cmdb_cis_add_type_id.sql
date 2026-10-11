-- Migration 707: Add type_id FK to cmdb_cis (ADR-013 §3.2.1)
-- 来源: docs/adr/ADR-013-CMDB-二阶模型决策.md §3.2.1
-- 目的: CMDB 二阶模型 Phase 2 - 为现有 CI 关联类型 (nullable, 非破坏)
-- 兼容性: ADD COLUMN IF NOT EXISTS + nullable + 无默认值
--   - 新 CI 创建时可选填 type_id, 老 CI 保留 NULL (Migration 708 负责回填)
--   - 已有查询不受影响 (WHERE 条件不引用 type_id)
-- 回滚: 707_cmdb_cis_add_type_id_down.sql

BEGIN;

-- type_id 可为 NULL 允许渐进迁移; FK 保证引用完整性
ALTER TABLE cmdb_cis
    ADD COLUMN IF NOT EXISTS type_id UUID
    REFERENCES cmdb_ci_types(id) ON DELETE SET NULL;

-- 按类型列出 CI 的高频查询 (ListByType)
CREATE INDEX IF NOT EXISTS idx_cmdb_cis_type_id ON cmdb_cis (type_id);

-- 复合索引: 按 tenant + type 聚合
CREATE INDEX IF NOT EXISTS idx_cmdb_cis_tenant_type_id ON cmdb_cis (tenant_id, type_id);

COMMENT ON COLUMN cmdb_cis.type_id IS
    '指向 cmdb_ci_types.id; NULL 表示未归类 (老数据, 或用户选择保留字符串 ci_type); ADR-013 方案 C 渐进式';

COMMIT;
