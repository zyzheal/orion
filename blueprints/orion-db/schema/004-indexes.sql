-- 004-indexes.sql
-- 索引设计
-- 版本：v1.0
-- 创建日期：2026-04-11

-- ============================================================================
-- 复合索引
-- ============================================================================

-- core.users 复合索引
CREATE INDEX idx_users_tenant_status_created ON core.users(tenant_id, status, created_at DESC);
CREATE INDEX idx_users_tenant_department ON core.users(tenant_id, department);
CREATE INDEX idx_users_tenant_email ON core.users(tenant_id, email);

-- core.teams 复合索引
CREATE INDEX idx_teams_tenant_parent ON core.teams(tenant_id, parent_id);
CREATE INDEX idx_teams_tenant_owner ON core.teams(tenant_id, owner_id);

-- core.team_members 复合索引
CREATE INDEX idx_team_members_tenant_team ON core.team_members(tenant_id, team_id);
CREATE INDEX idx_team_members_tenant_user ON core.team_members(tenant_id, user_id);

-- core.product_lines 复合索引
CREATE INDEX idx_product_lines_tenant_team ON core.product_lines(tenant_id, team_id);
CREATE INDEX idx_product_lines_tenant_status ON core.product_lines(tenant_id, status);

-- ============================================================================
-- cmdb 索引
-- ============================================================================

-- cmdb.hosts 复合索引
CREATE INDEX idx_hosts_tenant_ip ON cmdb.hosts(tenant_id, ip);
CREATE INDEX idx_hosts_tenant_status ON cmdb.hosts(tenant_id, status);
CREATE INDEX idx_hosts_tenant_deleted ON cmdb.hosts(tenant_id, deleted);

-- cmdb.host_ssh_configs 复合索引
CREATE INDEX idx_ssh_configs_tenant_host ON cmdb.host_ssh_configs(tenant_id, host_id);

-- cmdb.k8s_clusters 复合索引
CREATE INDEX idx_k8s_clusters_tenant_status ON cmdb.k8s_clusters(tenant_id, status);

-- cmdb.k8s_deployments 复合索引
CREATE INDEX idx_k8s_deployments_tenant_cluster ON cmdb.k8s_deployments(tenant_id, cluster_id);
CREATE INDEX idx_k8s_deployments_tenant_ns ON cmdb.k8s_deployments(tenant_id, namespace);

-- ============================================================================
-- cicd 索引
-- ============================================================================

-- cicd.pipelines 复合索引
CREATE INDEX idx_cicd_pipelines_tenant_enabled ON cicd.pipelines(tenant_id, enabled);
CREATE INDEX idx_cicd_pipelines_tenant_pl ON cicd.pipelines(tenant_id, product_line_id);

-- cicd.pipeline_runs 复合索引
CREATE INDEX idx_pipeline_runs_tenant_pipeline ON cicd.pipeline_runs(tenant_id, pipeline_id);
CREATE INDEX idx_pipeline_runs_tenant_status ON cicd.pipeline_runs(tenant_id, status);
CREATE INDEX idx_pipeline_runs_tenant_created ON cicd.pipeline_runs(tenant_id, create_time DESC);
CREATE INDEX idx_pipeline_runs_pipeline_status ON cicd.pipeline_runs(pipeline_id, status);

-- cicd.deployment_history 复合索引
CREATE INDEX idx_deployment_history_tenant_env ON cicd.deployment_history(tenant_id, environment);
CREATE INDEX idx_deployment_history_tenant_status ON cicd.deployment_history(tenant_id, status);
CREATE INDEX idx_deployment_history_tenant_created ON cicd.deployment_history(tenant_id, create_time DESC);
CREATE INDEX idx_deployment_history_pl_env ON cicd.deployment_history(product_line_id, environment);

-- ============================================================================
-- gitops 索引
-- ============================================================================

CREATE INDEX idx_gitops_apps_tenant_cluster ON gitops.applications(tenant_id, cluster_id);
CREATE INDEX idx_gitops_apps_tenant_sync_status ON gitops.applications(tenant_id, sync_status);
CREATE INDEX idx_gitops_apps_tenant_health ON gitops.applications(tenant_id, health_status);

-- ============================================================================
-- ai 索引
-- ============================================================================

-- ai.gpu_pools 复合索引
CREATE INDEX idx_gpu_pools_tenant_status ON ai.gpu_pools(tenant_id, status);
CREATE INDEX idx_gpu_pools_tenant_type ON ai.gpu_pools(tenant_id, gpu_type);

-- ai.inference_logs 复合索引
CREATE INDEX idx_inference_logs_tenant_skill ON ai.inference_logs(tenant_id, skill_id);
CREATE INDEX idx_inference_logs_tenant_status ON ai.inference_logs(tenant_id, status);
CREATE INDEX idx_inference_logs_tenant_created ON ai.inference_logs(tenant_id, create_time DESC);
CREATE INDEX idx_inference_logs_skill_created ON ai.inference_logs(skill_id, create_time DESC);
CREATE INDEX idx_inference_logs_user_created ON ai.inference_logs(user_id, create_time DESC);

-- ============================================================================
-- audit 索引
-- ============================================================================

-- audit.logs 复合索引
CREATE INDEX idx_audit_logs_tenant_action ON audit.logs(tenant_id, action);
CREATE INDEX idx_audit_logs_tenant_resource ON audit.logs(tenant_id, resource_type, resource_id);
CREATE INDEX idx_audit_logs_tenant_created ON audit.logs(tenant_id, create_time DESC);
CREATE INDEX idx_audit_logs_user_action ON audit.logs(user_id, action);
CREATE INDEX idx_audit_logs_resource_created ON audit.logs(resource_type, resource_id, create_time DESC);

-- audit.event_logs 复合索引
CREATE INDEX idx_event_logs_tenant_type ON audit.event_logs(tenant_id, event_type);
CREATE INDEX idx_event_logs_tenant_created ON audit.event_logs(tenant_id, create_time DESC);
CREATE INDEX idx_event_logs_type_created ON audit.event_logs(event_type, create_time DESC);
CREATE INDEX idx_event_logs_correlation_trace ON audit.event_logs(correlation_id, trace_id);

-- audit.user_activity 复合索引
CREATE INDEX idx_user_activity_tenant_user ON audit.user_activity(tenant_id, user_id);
CREATE INDEX idx_user_activity_tenant_type ON audit.user_activity(tenant_id, activity_type);
CREATE INDEX idx_user_activity_tenant_created ON audit.user_activity(tenant_id, create_time DESC);
CREATE INDEX idx_user_activity_user_created ON audit.user_activity(user_id, create_time DESC);

-- ============================================================================
-- core 索引
-- ============================================================================

-- core.data_groups 复合索引
CREATE INDEX idx_data_groups_tenant_type ON core.data_groups(tenant_id, type);
CREATE INDEX idx_data_groups_tenant_parent ON core.data_groups(tenant_id, parent_id);

-- core.data_permissions 复合索引
CREATE INDEX idx_data_permissions_tenant_resource ON core.data_permissions(tenant_id, resource_type, resource_id);
CREATE INDEX idx_data_permissions_tenant_user ON core.data_permissions(tenant_id, user_id);
CREATE INDEX idx_data_permissions_tenant_team ON core.data_permissions(tenant_id, team_id);
CREATE INDEX idx_data_permissions_user_resource ON core.data_permissions(user_id, resource_type, resource_id);

-- ============================================================================
-- 全文搜索索引
-- ============================================================================

-- 产品名称和描述全文搜索
CREATE INDEX idx_product_lines_search ON core.product_lines USING GIN (
    to_tsvector('english', name || ' ' || COALESCE(description, ''))
);

-- 团队名称全文搜索
CREATE INDEX idx_teams_search ON core.teams USING GIN (
    to_tsvector('english', name || ' ' || COALESCE(description, ''))
);

-- 用户姓名字段
CREATE INDEX idx_users_name_trgm ON core.users USING GIN (name gin_trgm_ops);

-- Git 提交消息全文搜索
CREATE INDEX idx_pipeline_runs_git_message_trgm ON cicd.pipeline_runs USING GIN (
    git_commit_message gin_trgm_ops
) WHERE git_commit_message IS NOT NULL;

-- ============================================================================
-- JSONB 索引
-- ============================================================================

-- 配额 JSONB 索引
CREATE INDEX idx_teams_quota_gin ON core.teams USING GIN (quota);

-- SSH 配置 extra 字段
CREATE INDEX idx_ssh_configs_extra_gin ON cmdb.host_ssh_configs USING GIN (extra);

-- 流水线 stages JSONB 索引
CREATE INDEX idx_cicd_pipelines_stages_gin ON cicd.pipelines USING GIN (stages);

-- GitOps sync_options JSONB 索引
CREATE INDEX idx_gitops_apps_sync_options_gin ON gitops.applications USING GIN (sync_options);

-- AI inference_logs input/output JSONB 索引
CREATE INDEX idx_inference_logs_input_gin ON ai.inference_logs USING GIN (input_data);
CREATE INDEX idx_inference_logs_output_gin ON ai.inference_logs USING GIN (output_data);

-- 审计日志 request/response JSONB 索引
CREATE INDEX idx_audit_logs_request_gin ON audit.logs USING GIN (request_data);
CREATE INDEX idx_audit_logs_response_gin ON audit.logs USING GIN (response_data);

-- event_logs event_data JSONB 索引
CREATE INDEX idx_event_logs_data_gin ON audit.event_logs USING GIN (event_data);

-- ============================================================================
-- 部分索引（Partial Indexes）
-- ============================================================================

-- 只索引未删除的主机
CREATE INDEX idx_hosts_active_tenant ON cmdb.hosts(tenant_id) WHERE deleted = FALSE;

-- 只索引启用的流水线
CREATE INDEX idx_cicd_pipelines_active ON cicd.pipelines(tenant_id) WHERE enabled = TRUE;

-- 只索引运行中的流水线
CREATE INDEX idx_pipeline_runs_running ON cicd.pipeline_runs(pipeline_id) WHERE status = 'running';

-- 只索引失败的部署
CREATE INDEX idx_deployment_history_failed ON cicd.deployment_history(tenant_id) WHERE status = 'failed';

-- 只索引健康状态异常的应用
CREATE INDEX idx_gitops_apps_unhealthy ON gitops.applications(tenant_id) WHERE health_status != 'healthy';

-- 只索引失败的推理请求
CREATE INDEX idx_inference_logs_failed ON ai.inference_logs(tenant_id) WHERE status = 'failed';

-- 只索引失败的审计操作
CREATE INDEX idx_audit_logs_failed ON audit.logs(tenant_id) WHERE status = 'failure';

-- ============================================================================
-- 覆盖索引（Covering Indexes）
-- ============================================================================

-- 用户列表查询覆盖索引
CREATE INDEX idx_users_tenant_covering ON core.users(tenant_id, status, created_at DESC)
    INCLUDE (id, name, email, department);

-- 团队列表覆盖索引
CREATE INDEX idx_teams_tenant_covering ON core.teams(tenant_id, status, created_at DESC)
    INCLUDE (id, name, description);

-- 流水线运行列表覆盖索引
CREATE INDEX idx_pipeline_runs_covering ON cicd.pipeline_runs(tenant_id, create_time DESC)
    INCLUDE (id, pipeline_id, status, current_stage, duration_seconds);

-- 审计日志列表覆盖索引
CREATE INDEX idx_audit_logs_covering ON audit.logs(tenant_id, create_time DESC)
    INCLUDE (id, user_id, action, resource_type, status);

-- ============================================================================
-- 唯一索引
-- ============================================================================

-- 确保租户内名称唯一性
CREATE UNIQUE INDEX idx_product_lines_tenant_name_unique ON core.product_lines(tenant_id, pl_id)
    WHERE deleted IS NOT TRUE;

CREATE UNIQUE INDEX idx_teams_tenant_name_unique ON core.teams(tenant_id, name);

CREATE UNIQUE INDEX idx_hosts_tenant_ip_unique ON cmdb.hosts(tenant_id, ip) WHERE deleted = FALSE;

CREATE UNIQUE INDEX idx_k8s_clusters_tenant_name_unique ON cmdb.k8s_clusters(tenant_id, name);

CREATE UNIQUE INDEX idx_gitops_apps_tenant_name_unique ON gitops.applications(tenant_id, name);

-- ============================================================================
-- 统计信息更新
-- ============================================================================

-- 更新所有表的统计信息
ANALYZE core.users;
ANALYZE core.teams;
ANALYZE core.team_members;
ANALYZE core.product_lines;
ANALYZE cmdb.hosts;
ANALYZE cmdb.k8s_clusters;
ANALYZE cicd.pipelines;
ANALYZE cicd.pipeline_runs;
ANALYZE gitops.applications;
ANALYZE ai.gpu_pools;
ANALYZE ai.inference_logs;
ANALYZE audit.logs;
ANALYZE audit.event_logs;
