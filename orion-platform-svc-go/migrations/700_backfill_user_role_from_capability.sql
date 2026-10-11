-- 700_backfill_user_role_from_capability.sql
--
-- G1: 从 capability.user_roles (JSON 数组) 双写回灌到 user_role 表。
--
-- 前置条件：capability 表存在且含 user_roles 列（JSON 或 JSONB）。
-- 幂等性：使用 ON CONFLICT DO NOTHING，可安全重复执行。
--
-- 参考：backend-g1-g3-implementation-spec-2026-10-11.md §2.4

-- 从 capability.user_roles JSON 数组展开为 user_role 行
-- 假设 capability 表结构：
--   capability(id UUID, user_id UUID, tenant_id UUID, user_roles JSON, ...)
INSERT INTO user_role (tenant_id, user_id, role, source, granted_by, granted_at, status)
SELECT
    c.tenant_id,
    c.user_id,
    role_value::TEXT,
    'import:capability',
    NULL,
    now(),
    'active'
FROM capability c,
     LATERAL jsonb_array_elements_text(
         CASE
             WHEN jsonb_typeof(c.user_roles::jsonb) = 'array' THEN c.user_roles::jsonb
             ELSE '[]'::jsonb
         END
     ) AS role_value
WHERE c.tenant_id IS NOT NULL
  AND c.user_id IS NOT NULL
  AND role_value IS NOT NULL
ON CONFLICT ON CONSTRAINT uq_user_role_active DO NOTHING;

-- 验证：回灌后应有大量 user_role 行
-- SELECT COUNT(*) FROM user_role;
