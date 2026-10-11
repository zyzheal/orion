-- Migration 708: Backfill cmdb_ci_types from cmdb_cis.ci_type strings (ADR-013 §3.2.1)
-- 来源: docs/adr/ADR-013-CMDB-二阶模型决策.md §3.2.1
-- 目的: CMDB 二阶模型 Phase 3 - 为现有 CI 创建对应类型并回填 type_id
-- 兼容性: 幂等 (ON CONFLICT DO NOTHING + WHERE type_id IS NULL)
--   - 已存在的 (tenant_id, name) 组合不重复创建
--   - 已有 type_id 的 CI 不覆盖 (只填 NULL 的)
-- 回滚: 708_cmdb_ci_types_backfill_down.sql

BEGIN;

-- Step 1: 为每个 (tenant_id, ci_type) 组合创建一条 cmdb_ci_types 记录
--   attributes 初始化为空数组 '[]', 用户可后续在 UI 补充属性定义
--   ON CONFLICT DO NOTHING 保证幂等 (若 Migration 706 或手工操作已创建同类型, 跳过)
INSERT INTO cmdb_ci_types (tenant_id, name, attributes)
SELECT DISTINCT
    tenant_id::TEXT,
    ci_type AS name,
    '[]'::JSONB
FROM cmdb_cis
WHERE ci_type IS NOT NULL
  AND ci_type <> ''
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Step 2: 回填 type_id 到已有的 cmdb_cis 记录
--   按 (tenant_id, ci_type = name) 匹配
--   WHERE type_id IS NULL 保证不覆盖已经手工设置的 type_id
UPDATE cmdb_cis c
SET type_id = t.id,
    updated_at = NOW()
FROM cmdb_ci_types t
WHERE c.tenant_id::TEXT = t.tenant_id
  AND c.ci_type = t.name
  AND c.type_id IS NULL;

COMMIT;
