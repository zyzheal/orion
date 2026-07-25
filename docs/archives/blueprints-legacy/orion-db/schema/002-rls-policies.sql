-- 002-rls-policies.sql
-- 行级安全策略 (Row Level Security Policies)
-- 版本：v1.0
-- 创建日期：2026-04-11

-- ============================================================================
-- 启用行级安全 (RLS)
-- ============================================================================

-- 为核心表启用 RLS
ALTER TABLE core.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.product_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.data_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.data_permissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE cmdb.hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb.host_ssh_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb.k8s_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb.k8s_deployments ENABLE ROW LEVEL SECURITY;

ALTER TABLE cicd.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE cicd.pipeline_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE gitops.applications ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai.gpu_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai.inference_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.event_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 租户隔离策略 - 基于 tenant_id
-- ============================================================================

-- 创建获取当前租户 ID 的函数
-- 在实际应用中，tenant_id 应该从 JWT token 或 session 中获取
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS BIGINT AS $$
BEGIN
    -- 从 PostgreSQL 设置中获取 tenant_id
    -- 应用层通过 SET app.current_tenant_id = 'xxx' 设置
    RETURN NULLIF(current_setting('app.current_tenant_id', TRUE), '')::BIGINT;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建获取当前用户 ID 的函数
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- core.users 策略
-- ============================================================================

-- 用户只能看到自己租户的用户
CREATE POLICY tenant_isolation_users ON core.users
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- 允许超级管理员访问所有租户
CREATE POLICY superuser_access_users ON core.users
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM core.users u
            WHERE u.id = current_user_id()
            AND u.status = 'active'
        )
        AND current_setting('app.is_superuser', TRUE) = 'true'
    );

-- ============================================================================
-- core.teams 策略
-- ============================================================================

CREATE POLICY tenant_isolation_teams ON core.teams
    FOR ALL
    USING (tenant_id = current_tenant_id());

CREATE POLICY superuser_access_teams ON core.teams
    FOR ALL
    USING (current_setting('app.is_superuser', TRUE) = 'true');

-- ============================================================================
-- core.team_members 策略
-- ============================================================================

CREATE POLICY tenant_isolation_team_members ON core.team_members
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- 团队成员可以看到自己所在的团队
CREATE POLICY view_own_team_members ON core.team_members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM core.team_members tm
            WHERE tm.team_id = team_members.team_id
            AND tm.user_id = current_user_id()
        )
    );

-- ============================================================================
-- core.product_lines 策略
-- ============================================================================

CREATE POLICY tenant_isolation_product_lines ON core.product_lines
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- 团队成员可以看到团队的产品线
CREATE POLICY team_member_view_product_lines ON core.product_lines
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM core.team_members tm
            WHERE tm.team_id = product_lines.team_id
            AND tm.user_id = current_user_id()
        )
        OR current_setting('app.is_superuser', TRUE) = 'true'
    );

-- ============================================================================
-- cmdb.hosts 策略
-- ============================================================================

CREATE POLICY tenant_isolation_hosts ON cmdb.hosts
    FOR ALL
    USING (tenant_id = current_tenant_id());

CREATE POLICY superuser_access_hosts ON cmdb.hosts
    FOR ALL
    USING (current_setting('app.is_superuser', TRUE) = 'true');

-- ============================================================================
-- cmdb.host_ssh_configs 策略
-- ============================================================================

CREATE POLICY tenant_isolation_ssh_configs ON cmdb.host_ssh_configs
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- SSH 配置敏感数据，只有管理员可以查看
CREATE POLICY admin_view_ssh_configs ON cmdb.host_ssh_configs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM core.team_members tm
            WHERE tm.role IN ('owner', 'admin')
            AND tm.user_id = current_user_id()
        )
        OR current_setting('app.is_superuser', TRUE) = 'true'
    );

-- ============================================================================
-- cmdb.k8s_clusters 策略
-- ============================================================================

CREATE POLICY tenant_isolation_k8s_clusters ON cmdb.k8s_clusters
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- cmdb.k8s_deployments 策略
-- ============================================================================

CREATE POLICY tenant_isolation_k8s_deployments ON cmdb.k8s_deployments
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- cicd.pipelines 策略
-- ============================================================================

CREATE POLICY tenant_isolation_pipelines ON cicd.pipelines
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- cicd.pipeline_runs 策略
-- ============================================================================

CREATE POLICY tenant_isolation_pipeline_runs ON cicd.pipeline_runs
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- gitops.applications 策略
-- ============================================================================

CREATE POLICY tenant_isolation_gitops_apps ON gitops.applications
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- ai.gpu_pools 策略
-- ============================================================================

CREATE POLICY tenant_isolation_gpu_pools ON ai.gpu_pools
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- ai.inference_logs 策略
-- ============================================================================

CREATE POLICY tenant_isolation_inference_logs ON ai.inference_logs
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- 用户可以查看自己的推理日志
CREATE POLICY view_own_inference_logs ON ai.inference_logs
    FOR SELECT
    USING (
        user_id = (SELECT id FROM core.users WHERE users.id = current_user_id())
        OR current_setting('app.is_superuser', TRUE) = 'true'
    );

-- ============================================================================
-- audit.logs 策略
-- ============================================================================

CREATE POLICY tenant_isolation_audit_logs ON audit.logs
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- 审计日志只允许插入，不允许普通用户查询
CREATE POLICY insert_audit_logs ON audit.logs
    FOR INSERT
    WITH CHECK (TRUE);

-- 管理员可以查询审计日志
CREATE POLICY admin_query_audit_logs ON audit.logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM core.team_members tm
            WHERE tm.role IN ('owner', 'admin')
            AND tm.user_id = current_user_id()
        )
        OR current_setting('app.is_superuser', TRUE) = 'true'
    );

-- ============================================================================
-- audit.event_logs 策略
-- ============================================================================

CREATE POLICY tenant_isolation_event_logs ON audit.event_logs
    FOR ALL
    USING (tenant_id = current_tenant_id());

CREATE POLICY insert_event_logs ON audit.event_logs
    FOR INSERT
    WITH CHECK (TRUE);

-- ============================================================================
-- core.data_groups 策略
-- ============================================================================

CREATE POLICY tenant_isolation_data_groups ON core.data_groups
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- core.data_permissions 策略
-- ============================================================================

CREATE POLICY tenant_isolation_data_permissions ON core.data_permissions
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- 用户只能查看自己有权限的资源
CREATE POLICY view_own_data_permissions ON core.data_permissions
    FOR SELECT
    USING (
        user_id = (SELECT id FROM core.users WHERE users.id = current_user_id())
        OR team_id IN (
            SELECT team_id FROM core.team_members WHERE user_id = current_user_id()
        )
        OR current_setting('app.is_superuser', TRUE) = 'true'
    );

-- ============================================================================
-- 强制 RLS 对表所有者也生效
-- ============================================================================

-- 这对于防止超级用户绕过 RLS 很有用（可选）
-- ALTER TABLE core.users FORCE ROW LEVEL SECURITY;
-- ALTER TABLE core.teams FORCE ROW LEVEL SECURITY;
-- ALTER TABLE cmdb.hosts FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS 测试辅助函数
-- ============================================================================

-- 设置租户上下文（用于测试）
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id BIGINT)
RETURNS void AS $$
BEGIN
    EXECUTE format('SET LOCAL app.current_tenant_id = %L', p_tenant_id);
END;
$$ LANGUAGE plpgsql;

-- 设置用户上下文（用于测试）
CREATE OR REPLACE FUNCTION set_user_context(p_user_id UUID)
RETURNS void AS $$
BEGIN
    EXECUTE format('SET LOCAL app.current_user_id = %L', p_user_id);
END;
$$ LANGUAGE plpgsql;

-- 设置超级用户标记
CREATE OR REPLACE FUNCTION set_superuser_context(p_is_superuser BOOLEAN)
RETURNS void AS $$
BEGIN
    EXECUTE format('SET LOCAL app.is_superuser = %L', CASE WHEN p_is_superuser THEN 'true' ELSE 'false' END);
END;
$$ LANGUAGE plpgsql;

-- 清除上下文
CREATE OR REPLACE FUNCTION clear_context()
RETURNS void AS $$
BEGIN
    RESET app.current_tenant_id;
    RESET app.current_user_id;
    RESET app.is_superuser;
END;
$$ LANGUAGE plpgsql;
