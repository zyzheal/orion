-- 005-initial-data.sql
-- 初始数据插入
-- 版本：v1.0
-- 创建日期：2026-04-11

-- ============================================================================
-- 插入测试租户数据
-- ============================================================================

-- 租户 1
SELECT set_tenant_context(1);

-- 创建超级管理员用户
INSERT INTO core.users (user_id, email, name, tenant_id, status, email_verified)
VALUES
    ('admin-001', 'admin@orion.com', '系统管理员', 1, 'active', TRUE),
    ('user-001', 'user1@orion.com', '测试用户 1', 1, 'active', TRUE),
    ('user-002', 'user2@orion.com', '测试用户 2', 1, 'active', TRUE);

-- 创建团队
INSERT INTO core.teams (team_id, name, description, owner_id, tenant_id, status)
SELECT
    'team-001',
    '基础架构团队',
    '负责基础设施和平台建设',
    (SELECT id FROM core.users WHERE user_id = 'admin-001'),
    1,
    'active';

-- 添加团队成员
INSERT INTO core.team_members (team_id, user_id, role, tenant_id, created_by)
SELECT
    t.id,
    u.id,
    CASE
        WHEN u.user_id = 'admin-001' THEN 'owner'
        WHEN u.user_id = 'user-001' THEN 'member'
        ELSE 'member'
    END,
    1,
    (SELECT id FROM core.users WHERE user_id = 'admin-001')
FROM core.teams t
CROSS JOIN core.users u
WHERE t.team_id = 'team-001'
  AND u.user_id IN ('admin-001', 'user-001', 'user-002');

-- 创建产品线
INSERT INTO core.product_lines (pl_id, name, description, team_id, owner_id, git_repo, tenant_id, status)
SELECT
    'pl-001',
    'Orion 平台',
    '统一的 DevOps 平台',
    (SELECT id FROM core.teams WHERE team_id = 'team-001'),
    (SELECT id FROM core.users WHERE user_id = 'admin-001'),
    'https://github.com/orion/orion-platform',
    1,
    'active';

-- 创建 K8s 集群
INSERT INTO cmdb.k8s_clusters (tenant_id, name, api_server, version, provider, region, credential_type, credential_ref, status)
VALUES
    (1, 'production-cluster', 'https://k8s-prod.example.com:6443', '1.28.0', 'self-hosted', 'cn-beijing', 'kubeconfig', 'prod-kubeconfig', 'active'),
    (1, 'staging-cluster', 'https://k8s-staging.example.com:6443', '1.28.0', 'self-hosted', 'cn-beijing', 'kubeconfig', 'staging-kubeconfig', 'active');

-- 创建 GPU 资源池
INSERT INTO ai.gpu_pools (tenant_id, name, gpu_type, total_gpus, total_memory_gb, status)
VALUES
    (1, 'AI 训练集群', 'NVIDIA A100', 8, 640, 'active'),
    (1, 'AI 推理集群', 'NVIDIA T4', 16, 256, 'active');

-- 创建主机
INSERT INTO cmdb.hosts (tenant_id, name, hostname, ip, port, os_type, os_version, cpu_cores, memory_bytes, disk_bytes, status)
VALUES
    (1, 'web-server-01', 'web01.prod.internal', '192.168.1.10', 22, 'Linux', 'Ubuntu 22.04', 8, 17179869184, 107374182400, 'active'),
    (1, 'web-server-02', 'web02.prod.internal', '192.168.1.11', 22, 'Linux', 'Ubuntu 22.04', 8, 17179869184, 107374182400, 'active'),
    (1, 'db-server-01', 'db01.prod.internal', '192.168.1.20', 22, 'Linux', 'Ubuntu 22.04', 16, 68719476736, 536870912000, 'active');

-- 创建 SSH 配置
INSERT INTO cmdb.host_ssh_configs (tenant_id, host_id, auth_type, username, extra)
SELECT
    1,
    h.id,
    'KEY',
    'ubuntu',
    '{"key_path": "/etc/orion/ssh/orion_key"}'::jsonb
FROM cmdb.hosts h
WHERE h.tenant_id = 1;

-- 创建流水线
INSERT INTO cicd.pipelines (tenant_id, name, description, product_line_id, trigger_type, stages, enabled)
VALUES
    (1, 'CI Pipeline', '持续集成流水线', 1, 'webhook',
     '[{"name": "build", "steps": ["checkout", "npm install", "npm build"]}, {"name": "test", "steps": ["unit test", "integration test"]}, {"name": "deploy", "steps": ["kubectl apply"]}]'::jsonb,
     TRUE),
    (1, 'CD Pipeline', '持续部署流水线', 1, 'auto',
     '[{"name": "validate", "steps": ["helm lint"]}, {"name": "deploy", "steps": ["helm upgrade"]}]'::jsonb,
     TRUE);

-- 创建 GitOps 应用
INSERT INTO gitops.applications (tenant_id, name, namespace, cluster_id, git_repo, git_revision, git_path, sync_policy, prune_enabled, self_heal_enabled)
VALUES
    (1, 'orion-api', 'orion-system', 1, 'https://github.com/orion/orion-api', 'main', 'k8s/overlays/production', 'auto', TRUE, TRUE),
    (1, 'orion-visor', 'orion-system', 1, 'https://github.com/orion/orion-visor', 'main', 'k8s/overlays/production', 'auto', TRUE, TRUE);

-- 插入审计日志示例
INSERT INTO audit.logs (tenant_id, user_id, action, resource_type, resource_id, status, ip_address)
VALUES
    (1, 1, 'USER_LOGIN', 'user', 1, 'success', '192.168.1.100'),
    (1, 1, 'RESOURCE_CREATE', 'team', 1, 'success', '192.168.1.100'),
    (1, 2, 'PIPELINE_TRIGGER', 'pipeline', 1, 'success', '192.168.1.101');

-- 插入事件日志示例
INSERT INTO audit.event_logs (tenant_id, event_type, event_source, event_data, severity, user_id)
VALUES
    (1, 'SYSTEM_STARTUP', 'system', '{"message": "Orion platform started"}'::jsonb, 'info', NULL),
    (1, 'USER_REGISTERED', 'auth', '{"email": "newuser@orion.com"}'::jsonb, 'info', 2),
    (1, 'DEPLOYMENT_COMPLETED', 'cicd', '{"pipeline": "CI Pipeline", "version": "1.0.0"}'::jsonb, 'info', 1);

-- 清除上下文
SELECT clear_context();

-- ============================================================================
-- 租户 2 数据
-- ============================================================================

SELECT set_tenant_context(2);

-- 创建租户 2 用户
INSERT INTO core.users (user_id, email, name, tenant_id, status, email_verified)
VALUES
    ('admin-002', 'admin2@orion.com', '租户 2 管理员', 2, 'active', TRUE),
    ('user-003', 'user3@orion.com', '测试用户 3', 2, 'active', TRUE);

-- 创建租户 2 团队
INSERT INTO core.teams (team_id, name, description, owner_id, tenant_id, status)
SELECT
    'team-002',
    '开发团队 A',
    '负责产品开发',
    (SELECT id FROM core.users WHERE user_id = 'admin-002'),
    2,
    'active';

-- 租户 2 团队成员
INSERT INTO core.team_members (team_id, user_id, role, tenant_id, created_by)
SELECT
    t.id,
    u.id,
    'member',
    2,
    (SELECT id FROM core.users WHERE user_id = 'admin-002')
FROM core.teams t
CROSS JOIN core.users u
WHERE t.team_id = 'team-002'
  AND u.tenant_id = 2;

SELECT clear_context();

-- ============================================================================
-- 验证数据
-- ============================================================================

-- 验证租户隔离
SELECT '租户 1 用户数：' as metric, count(*) as value FROM core.users WHERE tenant_id = 1
UNION ALL
SELECT '租户 2 用户数：', count(*) FROM core.users WHERE tenant_id = 2
UNION ALL
SELECT '总团队数：', count(*) FROM core.teams
UNION ALL
SELECT '总主机数：', count(*) FROM cmdb.hosts
UNION ALL
SELECT '总流水线数：', count(*) FROM cicd.pipelines;
