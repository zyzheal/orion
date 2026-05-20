-- ============================================================
-- 租户隔离迁移脚本
-- 作者: Orion Platform
-- 日期: 2026-05-20
-- 描述: 为PandaWiki添加多租户支持
-- ============================================================

-- 开始事务
BEGIN;

-- ============================================================
-- 1. 为 spaces 表添加 tenant_id 字段
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'spaces' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE spaces ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
    END IF;
END $$;

-- ============================================================
-- 2. 为 nodes 表添加 tenant_id 字段 (PandaWiki使用nodes而非documents)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'nodes' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE nodes ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
    END IF;
END $$;

-- ============================================================
-- 3. 为 users 表添加 orion_user_id 字段
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'orion_user_id'
    ) THEN
        ALTER TABLE users ADD COLUMN orion_user_id VARCHAR(36) UNIQUE;
    END IF;
END $$;

-- ============================================================
-- 4. 为 conversations 表添加 tenant_id 字段
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversations' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE conversations ADD COLUMN tenant_id VARCHAR(36) NOT NULL DEFAULT 'default';
    END IF;
END $$;

-- ============================================================
-- 5. 创建索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_spaces_tenant ON spaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nodes_tenant ON nodes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_orion ON users(orion_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);

-- ============================================================
-- 6. 添加唯一约束 (租户内资源唯一)
-- ============================================================
ALTER TABLE spaces ADD CONSTRAINT uq_space_tenant_name
    UNIQUE (tenant_id, name);

ALTER TABLE nodes ADD CONSTRAINT uq_node_tenant_kb_title
    UNIQUE (tenant_id, parent_knowledge_base_id, title);

-- ============================================================
-- 7. 创建租户上下文函数 (用于RLS)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'current_tenant_id'
    ) THEN
        CREATE OR REPLACE FUNCTION current_tenant_id()
        RETURNS VARCHAR(36) AS $$
        BEGIN
            -- 从 search_path 中的自定义配置获取当前租户
            -- 如果没有设置，返回 'default'
            RETURN COALESCE(current_setting('app.tenant_id', true), 'default');
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    END IF;
END $$;

-- ============================================================
-- 8. 启用 RLS (可选，谨慎使用)
-- ============================================================
-- 注意: 启用RLS可能会影响现有功能，请先在测试环境验证

-- ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略 (示例)
-- DROP POLICY IF EXISTS tenant_isolation_spaces ON spaces;
-- CREATE POLICY tenant_isolation_spaces ON spaces
--     FOR ALL USING (tenant_id = current_tenant_id());

-- 提交事务
COMMIT;

-- ============================================================
-- 验证查询
-- ============================================================
SELECT
    (SELECT COUNT(*) FROM spaces WHERE tenant_id IS NULL) as spaces_without_tenant,
    (SELECT COUNT(*) FROM nodes WHERE tenant_id IS NULL) as nodes_without_tenant,
    (SELECT COUNT(*) FROM users WHERE orion_user_id IS NOT NULL) as users_with_orion_id,
    (SELECT COUNT(DISTINCT tenant_id) FROM spaces) as tenant_count;

-- 回滚脚本 (如需回滚)
-- BEGIN;
-- DROP INDEX IF EXISTS idx_spaces_tenant;
-- DROP INDEX IF EXISTS idx_nodes_tenant;
-- DROP INDEX IF EXISTS idx_users_orion;
-- DROP INDEX IF EXISTS idx_conversations_tenant;
-- ALTER TABLE spaces DROP COLUMN IF EXISTS tenant_id;
-- ALTER TABLE nodes DROP COLUMN IF EXISTS tenant_id;
-- ALTER TABLE users DROP COLUMN IF EXISTS orion_user_id;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS tenant_id;
-- DROP FUNCTION IF EXISTS current_tenant_id();
-- COMMIT;