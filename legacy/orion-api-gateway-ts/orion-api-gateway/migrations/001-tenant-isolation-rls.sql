-- ============================================================
-- Orion Platform 多租户隔离 RLS 迁移脚本
-- ============================================================
-- 功能：为所有业务表启用行级安全（Row-Level Security）
-- 适用：PostgreSQL 12+
-- 版本：v1.0.0
-- ============================================================

-- 开始事务
BEGIN;

-- ============================================================
-- 1. 创建应用会话变量配置
-- ============================================================

-- 设置当前租户的会话变量（通过 current_setting 访问）
-- 使用方式：SET app.current_tenant = 'tenant-uuid';

-- 创建应用配置扩展（如果不存在）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. 为现有表添加 tenant_id 列
-- ============================================================

-- 注意：如果表已存在 tenant_id 列，以下语句会报错，使用 DO 块忽略错误

DO $$
DECLARE
    table_name TEXT;
    column_exists BOOLEAN;
BEGIN
    -- 工作流表
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'workflows') THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'workflows' AND column_name = 'tenant_id'
        ) INTO column_exists;

        IF NOT column_exists THEN
            ALTER TABLE workflows ADD COLUMN tenant_id UUID NOT NULL DEFAULT uuid_generate_v4();
            CREATE INDEX IF NOT EXISTS idx_workflows_tenant_id ON workflows(tenant_id);
        END IF;
    END IF;

    -- 任务表
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tasks') THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'tenant_id'
        ) INTO column_exists;

        IF NOT column_exists THEN
            ALTER TABLE tasks ADD COLUMN tenant_id UUID NOT NULL DEFAULT uuid_generate_v4();
            CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id ON tasks(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_tenant_workflow ON tasks(tenant_id, workflow_id);
        END IF;
    END IF;

    -- 产出物表
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'artifacts') THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'artifacts' AND column_name = 'tenant_id'
        ) INTO column_exists;

        IF NOT column_exists THEN
            ALTER TABLE artifacts ADD COLUMN tenant_id UUID NOT NULL DEFAULT uuid_generate_v4();
            CREATE INDEX IF NOT EXISTS idx_artifacts_tenant_id ON artifacts(tenant_id);
        END IF;
    END IF;

    -- 提示词模板表
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prompts') THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'prompts' AND column_name = 'tenant_id'
        ) INTO column_exists;

        IF NOT column_exists THEN
            ALTER TABLE prompts ADD COLUMN tenant_id UUID NOT NULL DEFAULT uuid_generate_v4();
            CREATE INDEX IF NOT EXISTS idx_prompts_tenant_id ON prompts(tenant_id);
        END IF;
    END IF;

    -- 提示词版本表
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prompt_versions') THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'prompt_versions' AND column_name = 'tenant_id'
        ) INTO column_exists;

        IF NOT column_exists THEN
            ALTER TABLE prompt_versions ADD COLUMN tenant_id UUID NOT NULL DEFAULT uuid_generate_v4();
            CREATE INDEX IF NOT EXISTS idx_prompt_versions_tenant_id ON prompt_versions(tenant_id);
        END IF;
    END IF;

    -- 向量嵌入表
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'vector_embeddings') THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'vector_embeddings' AND column_name = 'tenant_id'
        ) INTO column_exists;

        IF NOT column_exists THEN
            ALTER TABLE vector_embeddings ADD COLUMN tenant_id UUID NOT NULL DEFAULT uuid_generate_v4();
            CREATE INDEX IF NOT EXISTS idx_vector_embeddings_tenant_id ON vector_embeddings(tenant_id);
        END IF;
    END IF;

    -- 知识文档表
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'knowledge_docs') THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'knowledge_docs' AND column_name = 'tenant_id'
        ) INTO column_exists;

        IF NOT column_exists THEN
            ALTER TABLE knowledge_docs ADD COLUMN tenant_id UUID NOT NULL DEFAULT uuid_generate_v4();
            CREATE INDEX IF NOT EXISTS idx_knowledge_docs_tenant_id ON knowledge_docs(tenant_id);
        END IF;
    END IF;

    -- API 密钥表
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'api_keys') THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'api_keys' AND column_name = 'tenant_id'
        ) INTO column_exists;

        IF NOT column_exists THEN
            ALTER TABLE api_keys ADD COLUMN tenant_id UUID NOT NULL DEFAULT uuid_generate_v4();
            CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);
        END IF;
    END IF;

    -- 审计日志表
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'audit_logs' AND column_name = 'tenant_id'
        ) INTO column_exists;

        IF NOT column_exists THEN
            ALTER TABLE audit_logs ADD COLUMN tenant_id UUID NOT NULL DEFAULT uuid_generate_v4();
            CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_time ON audit_logs(tenant_id, created_at);
        END IF;
    END IF;

    -- 通知表
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'notifications' AND column_name = 'tenant_id'
        ) INTO column_exists;

        IF NOT column_exists THEN
            ALTER TABLE notifications ADD COLUMN tenant_id UUID NOT NULL DEFAULT uuid_generate_v4();
            CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id);
        END IF;
    END IF;

    -- 租户表
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tenants') THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'tenants' AND column_name = 'tenant_id'
        ) INTO column_exists;

        IF NOT column_exists THEN
            ALTER TABLE tenants ADD COLUMN tenant_id UUID NOT NULL DEFAULT uuid_generate_v4();
            CREATE INDEX IF NOT EXISTS idx_tenants_tenant_id ON tenants(tenant_id);
        END IF;
    END IF;

    -- 租户配额表
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tenant_quotas') THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'tenant_quotas' AND column_name = 'tenant_id'
        ) INTO column_exists;

        IF NOT column_exists THEN
            ALTER TABLE tenant_quotas ADD COLUMN tenant_id UUID NOT NULL DEFAULT uuid_generate_v4();
            CREATE INDEX IF NOT EXISTS idx_tenant_quotas_tenant_id ON tenant_quotas(tenant_id);
        END IF;
    END IF;

    -- 租户共享表
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tenant_shares') THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'tenant_shares' AND column_name = 'tenant_id'
        ) INTO column_exists;

        IF NOT column_exists THEN
            ALTER TABLE tenant_shares ADD COLUMN tenant_id UUID NOT NULL DEFAULT uuid_generate_v4();
            CREATE INDEX IF NOT EXISTS idx_tenant_shares_tenant_id ON tenant_shares(tenant_id);
        END IF;
    END IF;
END $$;

-- ============================================================
-- 3. 创建租户数据共享表（用于跨租户协作）
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_tenant_id UUID NOT NULL,
    target_tenant_id UUID NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    permission TEXT NOT NULL DEFAULT 'read',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    status TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT chk_permission CHECK (permission IN ('read', 'write', 'execute')),
    CONSTRAINT chk_status CHECK (status IN ('active', 'revoked', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_shares_source ON tenant_shares(source_tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_shares_target ON tenant_shares(target_tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_shares_resource ON tenant_shares(resource_type, resource_id);

-- ============================================================
-- 4. 创建 RLS 策略函数
-- ============================================================

-- 获取当前租户 ID（从会话变量）
CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_tenant', true)::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取当前租户 ID（文本形式，用于错误消息）
CREATE OR REPLACE FUNCTION get_current_tenant_id_text() RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_tenant', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 检查租户共享访问权限
CREATE OR REPLACE FUNCTION check_tenant_share(p_resource_type TEXT, p_resource_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_tenant_id UUID;
    v_has_share BOOLEAN;
BEGIN
    v_tenant_id := get_current_tenant_id();

    IF v_tenant_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 检查是否存在有效的共享授权
    SELECT EXISTS (
        SELECT 1 FROM tenant_shares
        WHERE source_tenant_id = (SELECT tenant_id FROM tenants WHERE id = v_tenant_id LIMIT 1)
          AND target_tenant_id = v_tenant_id
          AND resource_type = p_resource_type
          AND resource_id = p_resource_id
          AND permission IN ('read', 'write', 'execute')
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
    ) INTO v_has_share;

    RETURN v_has_share;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. 为所有表启用 RLS 并创建策略
-- ============================================================

-- 通用 RLS 策略创建宏（使用 DO 块）
DO $$
DECLARE
    table_name TEXT;
    rls_enabled BOOLEAN;
BEGIN
    -- 定义需要启用 RLS 的表
    FOR table_name IN
        SELECT unnest(ARRAY[
            'workflows', 'tasks', 'artifacts', 'prompts', 'prompt_versions',
            'vector_embeddings', 'knowledge_docs', 'api_keys', 'audit_logs',
            'notifications', 'tenants', 'tenant_quotas'
        ])
    LOOP
        -- 检查表是否存在
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = table_name) THEN
            -- 检查 RLS 是否已启用
            SELECT rowsecurity FROM information_schema.tables
            WHERE table_name = table_name INTO rls_enabled;

            IF NOT rls_enabled THEN
                -- 启用 RLS
                EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);

                -- 创建 SELECT 策略
                EXECUTE format(
                    'CREATE POLICY %I ON %I FOR SELECT
                     USING (tenant_id = get_current_tenant_id())',
                    'tenant_isolation_select_' || table_name,
                    table_name
                );

                -- 创建 INSERT 策略
                EXECUTE format(
                    'CREATE POLICY %I ON %I FOR INSERT
                     WITH CHECK (tenant_id = get_current_tenant_id())',
                    'tenant_isolation_insert_' || table_name,
                    table_name
                );

                -- 创建 UPDATE 策略
                EXECUTE format(
                    'CREATE POLICY %I ON %I FOR UPDATE
                     USING (tenant_id = get_current_tenant_id())',
                    'tenant_isolation_update_' || table_name,
                    table_name
                );

                -- 创建 DELETE 策略
                EXECUTE format(
                    'CREATE POLICY %I ON %I FOR DELETE
                     USING (tenant_id = get_current_tenant_id())',
                    'tenant_isolation_delete_' || table_name,
                    table_name
                );
            END IF;
        END IF;
    END LOOP;
END $$;

-- ============================================================
-- 6. 为 tenant_shares 表创建特殊策略
-- ============================================================

-- tenant_shares 表的 SELECT 策略（允许查看自己的共享）
DROP POLICY IF EXISTS tenant_shares_select ON tenant_shares;
CREATE POLICY tenant_shares_select ON tenant_shares FOR SELECT
USING (
    source_tenant_id = get_current_tenant_id()
    OR target_tenant_id = get_current_tenant_id()
);

-- tenant_shares 表的 INSERT 策略（只能创建自己的共享）
DROP POLICY IF EXISTS tenant_shares_insert ON tenant_shares;
CREATE POLICY tenant_shares_insert ON tenant_shares FOR INSERT
WITH CHECK (source_tenant_id = get_current_tenant_id());

-- tenant_shares 表的 UPDATE 策略（只能修改自己创建的共享）
DROP POLICY IF EXISTS tenant_shares_update ON tenant_shares;
CREATE POLICY tenant_shares_update ON tenant_shares FOR UPDATE
USING (source_tenant_id = get_current_tenant_id());

-- tenant_shares 表的 DELETE 策略（只能删除自己创建的共享）
DROP POLICY IF EXISTS tenant_shares_delete ON tenant_shares;
CREATE POLICY tenant_shares_delete ON tenant_shares FOR DELETE
USING (source_tenant_id = get_current_tenant_id());

-- ============================================================
-- 7. 创建平台管理员绕过 RLS 的角色
-- ============================================================

-- 创建平台管理员角色（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'orion_platform_admin') THEN
        CREATE ROLE orion_platform_admin;
    END IF;
END $$;

-- 授予管理员绕过 RLS 的权限
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN
        SELECT unnest(ARRAY[
            'workflows', 'tasks', 'artifacts', 'prompts', 'prompt_versions',
            'vector_embeddings', 'knowledge_docs', 'api_keys', 'audit_logs',
            'notifications', 'tenants', 'tenant_quotas', 'tenant_shares'
        ])
    LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = table_name) THEN
            EXECUTE format(
                'GRANT ALL ON %I TO orion_platform_admin',
                table_name
            );
        END IF;
    END LOOP;
END $$;

-- ============================================================
-- 8. 创建租户管理函数
-- ============================================================

-- 设置租户上下文（供应用调用）
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id UUID) RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant', p_tenant_id::TEXT, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 清除租户上下文
CREATE OR REPLACE FUNCTION clear_tenant_context() RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant', NULL, false);
END;
$$ LANGUAGE plpgsql;

-- 获取当前租户信息
CREATE OR REPLACE FUNCTION get_current_tenant_info()
RETURNS TABLE (
    tenant_id UUID,
    tenant_name TEXT,
    tier TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.name, t.tier, t.status
    FROM tenants t
    WHERE t.id = get_current_tenant_id();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. 创建 RLS 违规审计触发器
-- ============================================================

CREATE TABLE IF NOT EXISTS rls_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    query_text TEXT,
    user_id UUID,
    ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_rls_violations_tenant ON rls_violations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rls_violations_time ON rls_violations(attempted_at);

-- 创建 RLS 违规记录函数
CREATE OR REPLACE FUNCTION log_rls_violation() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO rls_violations (tenant_id, table_name, operation, query_text, user_id)
    VALUES (
        get_current_tenant_id(),
        TG_TABLE_NAME,
        TG_OP,
        current_query(),
        get_current_tenant_id()
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 10. 创建租户配额表
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_quotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE,
    tier TEXT NOT NULL DEFAULT 'standard',
    cpu_request INTEGER NOT NULL DEFAULT 500,
    cpu_limit INTEGER NOT NULL DEFAULT 1000,
    memory_request INTEGER NOT NULL DEFAULT 512,
    memory_limit INTEGER NOT NULL DEFAULT 1024,
    storage_gb INTEGER NOT NULL DEFAULT 10,
    concurrent_runners INTEGER NOT NULL DEFAULT 5,
    queue_depth INTEGER NOT NULL DEFAULT 100,
    daily_token_quota BIGINT NOT NULL DEFAULT 100000,
    api_qps INTEGER NOT NULL DEFAULT 100,
    daily_hours_quota INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_tier CHECK (tier IN ('free', 'standard', 'premium'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_quotas_tenant ON tenant_quotas(tenant_id);

-- 更新触发器函数
CREATE OR REPLACE FUNCTION update_tenant_quota_timestamp() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 tenant_quotas 表添加更新触发器
DROP TRIGGER IF EXISTS update_tenant_quota_timestamp ON tenant_quotas;
CREATE TRIGGER update_tenant_quota_timestamp
    BEFORE UPDATE ON tenant_quotas
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_quota_timestamp();

-- ============================================================
-- 11. 创建租户表
-- ============================================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    display_name TEXT,
    tier TEXT NOT NULL DEFAULT 'standard',
    status TEXT NOT NULL DEFAULT 'active',
    namespace_pool_id TEXT NOT NULL,
    owner_user_id UUID,
    owner_email TEXT,
    business_unit TEXT,
    cost_center TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT chk_tenant_tier CHECK (tier IN ('free', 'standard', 'premium')),
    CONSTRAINT chk_tenant_status CHECK (status IN ('active', 'suspended', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_tenants_name ON tenants(name);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_namespace_pool ON tenants(namespace_pool_id);

-- 为 tenants 表添加更新触发器
DROP TRIGGER IF EXISTS update_tenants_timestamp ON tenants;
CREATE TRIGGER update_tenants_timestamp
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_quota_timestamp();

-- ============================================================
-- 提交事务
-- ============================================================

COMMIT;

-- ============================================================
-- 验证脚本
-- ============================================================

-- 检查 RLS 是否已启用
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('workflows', 'tasks', 'artifacts', 'prompts', 'tenant_quotas')
ORDER BY tablename;

-- 检查 RLS 策略
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
