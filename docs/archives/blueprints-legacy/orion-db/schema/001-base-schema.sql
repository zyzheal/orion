-- 001-base-schema.sql
-- Orion 平台基础 Schema 设计
-- 版本：v1.0
-- 创建日期：2026-04-11

-- 启用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================================================
-- 核心模式 (core schema) - 用户与团队
-- ============================================================================

-- 用户表
CREATE TABLE core.users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         VARCHAR(64) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(128) NOT NULL,
    avatar_url      VARCHAR(512),
    department      VARCHAR(255),
    title           VARCHAR(128),
    phone           VARCHAR(32),

    -- 认证信息
    password_hash   VARCHAR(255),
    totp_secret     VARCHAR(64),
    last_login_at   TIMESTAMPTZ,
    last_login_ip   VARCHAR(45),

    -- 状态
    status          VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    email_verified  BOOLEAN DEFAULT FALSE,

    -- 元数据
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by      UUID REFERENCES core.users(id),

    -- 租户 ID（多租户隔离）
    tenant_id       BIGINT NOT NULL
);

CREATE INDEX idx_users_tenant ON core.users(tenant_id);
CREATE INDEX idx_users_email ON core.users(email);
CREATE INDEX idx_users_department ON core.users(department);
CREATE INDEX idx_users_status ON core.users(status);
CREATE INDEX idx_users_tenant_status ON core.users(tenant_id, status);

-- 团队表
CREATE TABLE core.teams (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         VARCHAR(64) UNIQUE NOT NULL,
    name            VARCHAR(128) NOT NULL,
    description     TEXT,
    parent_id       UUID REFERENCES core.teams(id),

    -- 负责人
    owner_id        UUID NOT NULL REFERENCES core.users(id),

    -- 配置
    timezone        VARCHAR(64) DEFAULT 'Asia/Shanghai',
    notification_channel VARCHAR(255),

    -- 配额 (JSON 格式)
    quota           JSONB,

    -- 状态
    status          VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),

    -- 元数据
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- 租户 ID
    tenant_id       BIGINT NOT NULL
);

CREATE INDEX idx_teams_tenant ON core.teams(tenant_id);
CREATE INDEX idx_teams_parent ON core.teams(parent_id);
CREATE INDEX idx_teams_owner ON core.teams(owner_id);
CREATE INDEX idx_teams_tenant_status ON core.teams(tenant_id, status);

-- 团队成员关系表
CREATE TABLE core.team_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL REFERENCES core.teams(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    role            VARCHAR(16) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),

    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by      UUID REFERENCES core.users(id),

    tenant_id       BIGINT NOT NULL
);

CREATE UNIQUE INDEX uk_team_user ON core.team_members(team_id, user_id);
CREATE INDEX idx_team_members_user ON core.team_members(user_id);
CREATE INDEX idx_team_members_tenant ON core.team_members(tenant_id);

-- 产品线表
CREATE TABLE core.product_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pl_id               VARCHAR(64) UNIQUE NOT NULL,
    name                VARCHAR(128) NOT NULL,
    description         TEXT,

    -- 归属
    team_id             UUID NOT NULL REFERENCES core.teams(id),
    owner_id            UUID NOT NULL REFERENCES core.users(id),

    -- 仓库信息
    git_repo            VARCHAR(512) NOT NULL,
    default_branch      VARCHAR(64) DEFAULT 'main',

    -- 技术栈
    language            VARCHAR(64),
    framework           VARCHAR(64),
    build_tool          VARCHAR(64),

    -- 部署配置
    deploy_type         VARCHAR(32) DEFAULT 'kubernetes' CHECK (deploy_type IN ('kubernetes', 'ecs', 'serverless', 'static')),
    runtime             VARCHAR(64),

    -- 状态
    status              VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),

    -- 元数据
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by          UUID REFERENCES core.users(id),

    -- 租户 ID
    tenant_id           BIGINT NOT NULL
);

CREATE INDEX idx_product_lines_tenant ON core.product_lines(tenant_id);
CREATE INDEX idx_product_lines_team ON core.product_lines(team_id);
CREATE INDEX idx_product_lines_status ON core.product_lines(status);
CREATE UNIQUE INDEX uk_team_pl ON core.product_lines(team_id, pl_id);

-- 更新触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为所有表添加更新触发器
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON core.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON core.teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_lines_updated_at
    BEFORE UPDATE ON core.product_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CMDB 模式 (cmdb schema) - 主机资产
-- ============================================================================

-- 主机表
CREATE TABLE cmdb.hosts (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL,
    name            VARCHAR(64) NOT NULL,
    hostname        VARCHAR(128),
    ip              VARCHAR(45) NOT NULL,
    port            INTEGER NOT NULL DEFAULT 22,
    os_type         VARCHAR(32),
    os_version      VARCHAR(64),
    cpu_cores       INTEGER,
    memory_bytes    BIGINT,
    disk_bytes      BIGINT,
    arch            VARCHAR(16),
    status          VARCHAR(16),
    agent_key       VARCHAR(64),
    agent_status    VARCHAR(16),
    last_seen_at    TIMESTAMPTZ,

    create_time     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    update_time     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    creator         VARCHAR(64),
    deleted         BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_hosts_tenant ON cmdb.hosts(tenant_id);
CREATE INDEX idx_hosts_ip ON cmdb.hosts(ip);
CREATE INDEX idx_hosts_agent_key ON cmdb.hosts(agent_key);
CREATE INDEX idx_hosts_deleted ON cmdb.hosts(deleted) WHERE deleted = TRUE;

-- 主机 SSH 配置表
CREATE TABLE cmdb.host_ssh_configs (
    id              BIGSERIAL PRIMARY KEY,
    host_id         BIGINT NOT NULL REFERENCES cmdb.hosts(id),
    auth_type       VARCHAR(16) NOT NULL CHECK (auth_type IN ('PASSWORD', 'KEY')),
    username        VARCHAR(64) NOT NULL,
    password        TEXT,
    private_key     TEXT,
    passphrase      TEXT,
    timeout         INTEGER DEFAULT 30,
    extra           JSONB,

    create_time     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    update_time     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    creator         VARCHAR(64),

    tenant_id       BIGINT NOT NULL
);

CREATE INDEX idx_ssh_configs_host ON cmdb.host_ssh_configs(host_id);
CREATE INDEX idx_ssh_configs_tenant ON cmdb.host_ssh_configs(tenant_id);

-- K8s 集群表
CREATE TABLE cmdb.k8s_clusters (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         BIGINT NOT NULL,
    name              VARCHAR(128) NOT NULL,
    api_server        VARCHAR(512) NOT NULL,
    version           VARCHAR(32),
    provider          VARCHAR(64),
    region            VARCHAR(128),

    credential_type   VARCHAR(32) NOT NULL,
    credential_ref    VARCHAR(255) NOT NULL,

    status            VARCHAR(16) NOT NULL DEFAULT 'pending',
    last_connected_at TIMESTAMPTZ,

    create_time       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    update_time       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    creator           VARCHAR(64)
);

CREATE INDEX idx_k8s_clusters_tenant ON cmdb.k8s_clusters(tenant_id);
CREATE INDEX idx_k8s_clusters_name ON cmdb.k8s_clusters(name);
CREATE UNIQUE INDEX uk_k8s_clusters_tenant_name ON cmdb.k8s_clusters(tenant_id, name);

-- K8s Deployment 表
CREATE TABLE cmdb.k8s_deployments (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         BIGINT NOT NULL,
    cluster_id        BIGINT NOT NULL REFERENCES cmdb.k8s_clusters(id),
    namespace         VARCHAR(128) NOT NULL,
    name              VARCHAR(255) NOT NULL,

    replicas          INTEGER NOT NULL DEFAULT 1,
    image             VARCHAR(512) NOT NULL,
    containers        JSONB,

    ready_replicas    INTEGER DEFAULT 0,
    available_replicas INTEGER DEFAULT 0,
    status            VARCHAR(16) NOT NULL DEFAULT 'pending',

    last_synced_at    TIMESTAMPTZ,
    sync_error        TEXT,

    create_time       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    update_time       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_k8s_deployments_tenant ON cmdb.k8s_deployments(tenant_id);
CREATE INDEX idx_k8s_deployments_cluster_ns ON cmdb.k8s_deployments(cluster_id, namespace);
CREATE INDEX idx_k8s_deployments_name ON cmdb.k8s_deployments(name);

-- ============================================================================
-- CI/CD 模式 (cicd schema)
-- ============================================================================

-- 流水线定义表
CREATE TABLE cicd.pipelines (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         BIGINT NOT NULL,
    name              VARCHAR(255) NOT NULL,
    description       TEXT,

    product_line_id   BIGINT,

    trigger_type      VARCHAR(32) NOT NULL,
    cron_expression   VARCHAR(64),
    stages            JSONB NOT NULL,
    timeout_minutes   INTEGER DEFAULT 60,

    enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    is_template       BOOLEAN NOT NULL DEFAULT FALSE,

    total_runs        INTEGER DEFAULT 0,
    success_rate      DECIMAL(5,2) DEFAULT 0,

    create_time       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    update_time       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    creator           VARCHAR(64)
);

CREATE INDEX idx_cicd_pipelines_tenant ON cicd.pipelines(tenant_id);
CREATE INDEX idx_cicd_pipelines_product_line ON cicd.pipelines(product_line_id);
CREATE INDEX idx_cicd_pipelines_enabled ON cicd.pipelines(enabled);

-- 流水线运行表（分片表）
CREATE TABLE cicd.pipeline_runs (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         BIGINT NOT NULL,
    pipeline_id       BIGINT NOT NULL REFERENCES cicd.pipelines(id),
    run_id            VARCHAR(64) NOT NULL,

    trigger_type      VARCHAR(32) NOT NULL,
    trigger_by        BIGINT,
    trigger_reason    TEXT,

    git_sha           VARCHAR(64),
    git_branch        VARCHAR(128),
    git_tag           VARCHAR(128),
    git_commit_message TEXT,

    status            VARCHAR(32) NOT NULL DEFAULT 'pending',
    current_stage     VARCHAR(128),

    queued_at         TIMESTAMPTZ,
    started_at        TIMESTAMPTZ,
    finished_at       TIMESTAMPTZ,
    duration_seconds  INTEGER,

    create_time       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pipeline_runs_tenant ON cicd.pipeline_runs(tenant_id);
CREATE INDEX idx_pipeline_runs_pipeline ON cicd.pipeline_runs(pipeline_id);
CREATE INDEX idx_pipeline_runs_run_id ON cicd.pipeline_runs(run_id);
CREATE INDEX idx_pipeline_runs_status ON cicd.pipeline_runs(status);
CREATE INDEX idx_pipeline_runs_created ON cicd.pipeline_runs(create_time DESC);

-- ============================================================================
-- GitOps 模式 (gitops schema)
-- ============================================================================

-- GitOps 应用表
CREATE TABLE gitops.applications (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         BIGINT NOT NULL,
    name              VARCHAR(255) NOT NULL,
    namespace         VARCHAR(128) NOT NULL,
    cluster_id        BIGINT REFERENCES cmdb.k8s_clusters(id),

    git_repo          VARCHAR(512) NOT NULL,
    git_revision      VARCHAR(128) NOT NULL DEFAULT 'HEAD',
    git_path          VARCHAR(512) NOT NULL,

    sync_policy       VARCHAR(32) NOT NULL DEFAULT 'manual',
    sync_options      JSONB,
    prune_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    self_heal_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    sync_status       VARCHAR(32) NOT NULL DEFAULT 'unknown',
    health_status     VARCHAR(32) NOT NULL DEFAULT 'unknown',
    last_synced_at    TIMESTAMPTZ,

    create_time       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    update_time       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    creator           VARCHAR(64)
);

CREATE INDEX idx_gitops_apps_tenant ON gitops.applications(tenant_id);
CREATE INDEX idx_gitops_apps_cluster_ns ON gitops.applications(cluster_id, namespace);
CREATE UNIQUE INDEX uk_gitops_apps_tenant_name ON gitops.applications(tenant_id, name);

-- ============================================================================
-- AI 模式 (ai schema)
-- ============================================================================

-- GPU 资源池表
CREATE TABLE ai.gpu_pools (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         BIGINT NOT NULL,
    name              VARCHAR(128) NOT NULL,

    gpu_type          VARCHAR(64) NOT NULL,
    total_gpus        INTEGER NOT NULL,
    total_memory_gb   INTEGER NOT NULL,

    allocated_gpus    INTEGER DEFAULT 0,
    allocated_memory_gb INTEGER DEFAULT 0,

    status            VARCHAR(16) NOT NULL DEFAULT 'active',

    create_time       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    update_time       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gpu_pools_tenant ON ai.gpu_pools(tenant_id);
CREATE INDEX idx_gpu_pools_status ON ai.gpu_pools(status);

-- AI 推理日志表（分片表）
CREATE TABLE ai.inference_logs (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         BIGINT NOT NULL,
    skill_id          BIGINT NOT NULL,

    input_data        JSONB NOT NULL,
    prompt            TEXT,

    output_data       JSONB,
    raw_response      TEXT,

    status            VARCHAR(32) NOT NULL,
    latency_ms        INTEGER,

    model_provider    VARCHAR(32),
    model_name        VARCHAR(64),
    tokens_used       INTEGER,

    user_id           BIGINT,
    run_id            BIGINT,

    is_fallback       BOOLEAN NOT NULL DEFAULT FALSE,
    fallback_reason   TEXT,

    create_time       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inference_logs_tenant ON ai.inference_logs(tenant_id);
CREATE INDEX idx_inference_logs_skill ON ai.inference_logs(skill_id);
CREATE INDEX idx_inference_logs_created ON ai.inference_logs(create_time DESC);

-- ============================================================================
-- 审计模式 (audit schema)
-- ============================================================================

-- 审计日志表（分片表）
CREATE TABLE audit.logs (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         BIGINT NOT NULL,
    user_id           BIGINT,
    action            VARCHAR(64) NOT NULL,
    resource_type     VARCHAR(64) NOT NULL,
    resource_id       BIGINT,
    request_data      JSONB,
    response_data     JSONB,
    ip_address        VARCHAR(45),
    user_agent        VARCHAR(512),
    status            VARCHAR(16) NOT NULL DEFAULT 'success',
    error_message     TEXT,
    duration_ms       INTEGER,
    create_time       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_tenant ON audit.logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit.logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit.logs(action);
CREATE INDEX idx_audit_logs_resource ON audit.logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit.logs(create_time DESC);

-- ============================================================================
-- 公共表 - 数据分组与权限
-- ============================================================================

-- 数据分组表
CREATE TABLE core.data_groups (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL,
    name            VARCHAR(128) NOT NULL,
    parent_id       BIGINT,
    level           VARCHAR(64),
    type            VARCHAR(32) NOT NULL,
    description     TEXT,
    sort_order      INTEGER DEFAULT 0,
    extra           JSONB,
    create_time     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    creator         VARCHAR(64)
);

CREATE INDEX idx_data_groups_tenant ON core.data_groups(tenant_id);
CREATE INDEX idx_data_groups_parent ON core.data_groups(parent_id);
CREATE INDEX idx_data_groups_level ON core.data_groups(level);

-- 数据权限表
CREATE TABLE core.data_permissions (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL,
    resource_type   VARCHAR(64) NOT NULL,
    resource_id     BIGINT NOT NULL,
    user_id         BIGINT,
    role_id         BIGINT,
    team_id         BIGINT,
    permissions     VARCHAR(64) NOT NULL,
    create_time     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    creator         VARCHAR(64)
);

CREATE INDEX idx_data_permissions_tenant ON core.data_permissions(tenant_id);
CREATE INDEX idx_data_permissions_resource ON core.data_permissions(resource_type, resource_id);
CREATE INDEX idx_data_permissions_user ON core.data_permissions(user_id);
CREATE INDEX idx_data_permissions_role ON core.data_permissions(role_id);
CREATE INDEX idx_data_permissions_team ON core.data_permissions(team_id);

-- ============================================================================
-- 事件日志表（分片表）
-- ============================================================================

CREATE TABLE audit.event_logs (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         BIGINT NOT NULL,
    event_type        VARCHAR(64) NOT NULL,
    event_source      VARCHAR(64),
    event_data        JSONB NOT NULL,
    severity          VARCHAR(16) DEFAULT 'info',

    correlation_id    VARCHAR(64),
    trace_id          VARCHAR(64),

    user_id           BIGINT,
    resource_type     VARCHAR(64),
    resource_id       BIGINT,

    create_time       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_event_logs_tenant ON audit.event_logs(tenant_id);
CREATE INDEX idx_event_logs_type ON audit.event_logs(event_type);
CREATE INDEX idx_event_logs_created ON audit.event_logs(create_time DESC);
CREATE INDEX idx_event_logs_correlation ON audit.event_logs(correlation_id);
