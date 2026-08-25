-- ============================================================
-- Plan 44 — RLS (Row Level Security) 覆盖审计
-- ============================================================
-- 优先级: P1
-- 来源: 全量代码扫描发现 — RLS 已启用但覆盖率未知
-- 本地证据:
--   - migrations/002_enable_rls.sql: 已启用 RLS
--   - orion-go-common/pkg/database/rls_test.go: 有 RLS 测试
--   - 544 个迁移文件中仅 2 个顶层 RLS 文件 — 部分模块可能未启用 RLS
-- 合并 Plan-29: multitenancy.go 的 BoundaryChecker 概念
-- 技术约束: PostgreSQL, RLS
-- ============================================================

-- ============================================================
-- 1. 审计: 查询所有表的 RLS 状态
-- ============================================================

-- 查看所有表的 RLS 启用情况
SELECT
    schemaname AS schema_name,
    tablename  AS table_name,
    rowsecurity AS rls_enabled,
    forcerowsecurity AS rls_forced,
    CASE
        WHEN rowsecurity = false THEN '⚠️ RLS NOT ENABLED'
        WHEN forcerowsecurity = false THEN '⚠️ RLS NOT FORCED'
        ELSE '✅ OK'
    END AS status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY
    rowsecurity ASC,         -- 未启用的排前面
    forcerowsecurity ASC,     -- 未强制启用的排前面
    tablename;

-- ============================================================
-- 2. 审计: 查询所有 RLS 策略
-- ============================================================

SELECT
    schemaname AS schema_name,
    tablename  AS table_name,
    policyname AS policy_name,
    permissive,
    roles,
    cmd AS command,
    qual AS using_expression,
    with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================
-- 3. 统计: RLS 覆盖率汇总
-- ============================================================

SELECT
    COUNT(*) AS total_tables,
    COUNT(*) FILTER (WHERE rowsecurity = true) AS rls_enabled_count,
    COUNT(*) FILTER (WHERE rowsecurity = false) AS rls_disabled_count,
    COUNT(*) FILTER (WHERE forcerowsecurity = true) AS rls_forced_count,
    ROUND(
        COUNT(*) FILTER (WHERE rowsecurity = true)::numeric /
        NULLIF(COUNT(*)::numeric, 0) * 100, 2
    ) AS rls_coverage_percent
FROM pg_tables
WHERE schemaname = 'public';

-- ============================================================
-- 4. 修复: 批量启用未启用 RLS 的表
-- ============================================================

-- 注意: 执行前请确认 tenant_id 列已存在
-- 以下 SQL 会生成 ALTER TABLE 语句，请审查后执行

SELECT format(
    'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;',
    tablename
) AS enable_rls_sql
FROM pg_tables
WHERE schemaname = 'public'
    AND rowsecurity = false
    AND tablename IN (
        -- 只对有 tenant_id 列的表启用 RLS
        SELECT DISTINCT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND column_name = 'tenant_id'
    );

-- ============================================================
-- 5. 修复: 批量强制 RLS (防止 SUPERUSER 绕过)
-- ============================================================

SELECT format(
    'ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;',
    tablename
) AS force_rls_sql
FROM pg_tables
WHERE schemaname = 'public'
    AND rowsecurity = true
    AND forcerowsecurity = false;

-- ============================================================
-- 6. 修复: 批量创建 RLS 策略 (对有 tenant_id 但无策略的表)
-- ============================================================

-- 生成创建策略的 SQL (审查后执行)
SELECT format(
    'CREATE POLICY IF NOT EXISTS %%s ON public.%%I USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid);',
    'rls_tenant_' || tablename || '_select',
    tablename
) AS create_policy_sql
FROM pg_tables t
WHERE t.schemaname = 'public'
    AND t.tablename IN (
        SELECT DISTINCT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND column_name = 'tenant_id'
    )
    AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public'
            AND p.tablename = t.tablename
    );

-- ============================================================
-- 7. 验证: 测试 RLS 是否生效
-- ============================================================

-- 设置租户 ID
SET app.tenant_id = '00000000-0000-0000-0000-000000000001';

-- 查询当前租户可见的数据 (应该只看到当前租户的数据)
-- SELECT COUNT(*) FROM <table_name> WHERE tenant_id != '00000000-0000-0000-0000-000000000001';
-- 如果 RLS 生效，上面查询应该返回 0

-- 重置
RESET app.tenant_id;

-- ============================================================
-- 8. Go 代码: RLS 审计服务
-- ============================================================

-- 对应 Go 代码参见同目录 audit.go
