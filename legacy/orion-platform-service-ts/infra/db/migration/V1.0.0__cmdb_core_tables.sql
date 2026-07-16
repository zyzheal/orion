-- CMDB Core Tables Schema
-- Flyway Migration V1.0.0
-- Description: Creates core CMDB tables for host, K8s, CI/CD resources and topology

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== Configuration Items (CI) ====================

-- CI Table - 配置项主表
CREATE TABLE IF NOT EXISTS cmdb_ci (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ci_id VARCHAR(64) NOT NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    ci_type VARCHAR(32) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    environment VARCHAR(64),
    tags TEXT[] DEFAULT '{}',
    attributes JSONB DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,

    -- Indexes for common queries
    CONSTRAINT uk_cmdb_ci UNIQUE (ci_id, tenant_id, deleted_at)
);

-- Indexes
CREATE INDEX idx_cmdb_ci_tenant ON cmdb_ci(tenant_id);
CREATE INDEX idx_cmdb_ci_type ON cmdb_ci(ci_type);
CREATE INDEX idx_cmdb_ci_status ON cmdb_ci(status);
CREATE INDEX idx_cmdb_ci_environment ON cmdb_ci(environment);
CREATE INDEX idx_cmdb_ci_tags ON cmdb_ci USING GIN(tags);
CREATE INDEX idx_cmdb_ci_attributes ON cmdb_ci USING GIN(attributes);
CREATE INDEX idx_cmdb_ci_created_at ON cmdb_ci(created_at DESC);
CREATE INDEX idx_cmdb_ci_deleted_at ON cmdb_ci(deleted_at);

-- ==================== CI Relations ====================

-- CI Relation Table - 配置项关联关系表
CREATE TABLE IF NOT EXISTS cmdb_ci_relation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_ci_id VARCHAR(64) NOT NULL,
    to_ci_id VARCHAR(64) NOT NULL,
    relation_type VARCHAR(32) NOT NULL,
    description TEXT,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT uk_cmdb_ci_relation UNIQUE (from_ci_id, to_ci_id, relation_type, deleted_at)
);

-- Indexes
CREATE INDEX idx_cmdb_ci_relation_from ON cmdb_ci_relation(from_ci_id);
CREATE INDEX idx_cmdb_ci_relation_to ON cmdb_ci_relation(to_ci_id);
CREATE INDEX idx_cmdb_ci_relation_type ON cmdb_ci_relation(relation_type);

-- ==================== CI Versions ====================

-- CI Version Table - 配置项版本历史表
CREATE TABLE IF NOT EXISTS cmdb_ci_version (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ci_id VARCHAR(64) NOT NULL,
    version INTEGER NOT NULL,
    changes TEXT,
    data JSONB NOT NULL,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_cmdb_ci_version UNIQUE (ci_id, version)
);

-- Indexes
CREATE INDEX idx_cmdb_ci_version_ci ON cmdb_ci_version(ci_id);
CREATE INDEX idx_cmdb_ci_version_created ON cmdb_ci_version(created_at DESC);

-- ==================== Host Resources ====================

-- Host Group Table - 主机组表
CREATE TABLE IF NOT EXISTS cmdb_host_group (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id BIGINT NOT NULL DEFAULT 0,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    parent_id UUID,
    path VARCHAR(512),
    sort_order INTEGER DEFAULT 0,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_cmdb_host_group_tenant ON cmdb_host_group(tenant_id);
CREATE INDEX idx_cmdb_host_group_parent ON cmdb_host_group(parent_id);
CREATE INDEX idx_cmdb_host_group_path ON cmdb_host_group(path);

-- Host Table - 主机资源表
CREATE TABLE IF NOT EXISTS cmdb_host (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id BIGINT NOT NULL DEFAULT 0,
    ci_id UUID NOT NULL REFERENCES cmdb_ci(id) ON DELETE CASCADE,
    group_id UUID REFERENCES cmdb_host_group(id),
    hostname VARCHAR(256) NOT NULL,
    ip_address INET NOT NULL,
    os_type VARCHAR(64),
    os_version VARCHAR(64),
    cpu_cores INTEGER,
    memory_mb BIGINT,
    disk_gb BIGINT,
    status VARCHAR(32) NOT NULL DEFAULT 'unknown',
    ssh_port INTEGER DEFAULT 22,
    ssh_user VARCHAR(64),
    labels JSONB DEFAULT '{}',
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_cmdb_host_tenant ON cmdb_host(tenant_id);
CREATE INDEX idx_cmdb_host_ci ON cmdb_host(ci_id);
CREATE INDEX idx_cmdb_host_group ON cmdb_host(group_id);
CREATE INDEX idx_cmdb_host_ip ON cmdb_host(ip_address);
CREATE INDEX idx_cmdb_host_status ON cmdb_host(status);
CREATE INDEX idx_cmdb_host_labels ON cmdb_host USING GIN(labels);

-- ==================== K8s Resources ====================

-- K8s Cluster Table - K8s 集群表
CREATE TABLE IF NOT EXISTS cmdb_k8s_cluster (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id BIGINT NOT NULL DEFAULT 0,
    name VARCHAR(128) NOT NULL,
    api_server_url VARCHAR(512) NOT NULL,
    version VARCHAR(32),
    status VARCHAR(32) NOT NULL DEFAULT 'unknown',
    node_count INTEGER DEFAULT 0,
    namespace_count INTEGER DEFAULT 0,
    kube_config_encrypted TEXT,
    ca_cert TEXT,
    token_encrypted TEXT,
    sync_enabled BOOLEAN DEFAULT true,
    sync_status VARCHAR(32) DEFAULT 'idle',
    last_sync_at TIMESTAMPTZ,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_cmdb_k8s_cluster_tenant ON cmdb_k8s_cluster(tenant_id);
CREATE INDEX idx_cmdb_k8s_cluster_status ON cmdb_k8s_cluster(status);

-- K8s Namespace Table - K8s 命名空间表
CREATE TABLE IF NOT EXISTS cmdb_k8s_namespace (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id BIGINT NOT NULL DEFAULT 0,
    cluster_id UUID NOT NULL REFERENCES cmdb_k8s_cluster(id),
    name VARCHAR(128) NOT NULL,
    uid VARCHAR(64) NOT NULL,
    resource_version VARCHAR(32),
    phase VARCHAR(32) NOT NULL DEFAULT 'Active',
    labels JSONB DEFAULT '{}',
    annotations JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT uk_k8s_namespace UNIQUE (cluster_id, name, deleted_at)
);

-- Indexes
CREATE INDEX idx_cmdb_k8s_ns_tenant ON cmdb_k8s_namespace(tenant_id);
CREATE INDEX idx_cmdb_k8s_ns_cluster ON cmdb_k8s_namespace(cluster_id);
CREATE INDEX idx_cmdb_k8s_ns_name ON cmdb_k8s_namespace(name);
CREATE INDEX idx_cmdb_k8s_ns_labels ON cmdb_k8s_namespace USING GIN(labels);

-- K8s Deployment Table - K8s 部署表
CREATE TABLE IF NOT EXISTS cmdb_k8s_deployment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id BIGINT NOT NULL DEFAULT 0,
    cluster_id UUID NOT NULL REFERENCES cmdb_k8s_cluster(id),
    namespace_id UUID REFERENCES cmdb_k8s_namespace(id),
    name VARCHAR(256) NOT NULL,
    uid VARCHAR(64) NOT NULL,
    resource_version VARCHAR(32),
    generation INTEGER DEFAULT 1,
    replicas INTEGER NOT NULL DEFAULT 1,
    ready_replicas INTEGER DEFAULT 0,
    available_replicas INTEGER DEFAULT 0,
    unavailable_replicas INTEGER DEFAULT 0,
    image_list TEXT[] DEFAULT '{}',
    labels JSONB DEFAULT '{}',
    annotations JSONB DEFAULT '{}',
    spec JSONB DEFAULT '{}',
    status JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT uk_k8s_deployment UNIQUE (cluster_id, namespace_id, name, deleted_at)
);

-- Indexes
CREATE INDEX idx_cmdb_k8s_deploy_tenant ON cmdb_k8s_deployment(tenant_id);
CREATE INDEX idx_cmdb_k8s_deploy_cluster ON cmdb_k8s_deployment(cluster_id);
CREATE INDEX idx_cmdb_k8s_deploy_ns ON cmdb_k8s_deployment(namespace_id);
CREATE INDEX idx_cmdb_k8s_deploy_name ON cmdb_k8s_deployment(name);
CREATE INDEX idx_cmdb_k8s_deploy_labels ON cmdb_k8s_deployment USING GIN(labels);

-- K8s Pod Table - K8s Pod 表
CREATE TABLE IF NOT EXISTS cmdb_k8s_pod (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id BIGINT NOT NULL DEFAULT 0,
    cluster_id UUID NOT NULL REFERENCES cmdb_k8s_cluster(id),
    namespace_id UUID REFERENCES cmdb_k8s_namespace(id),
    deployment_id UUID REFERENCES cmdb_k8s_deployment(id),
    name VARCHAR(256) NOT NULL,
    uid VARCHAR(64) NOT NULL,
    resource_version VARCHAR(32),
    node_name VARCHAR(256),
    host_ip INET,
    pod_ip INET,
    phase VARCHAR(32) NOT NULL DEFAULT 'Pending',
    restart_count INTEGER DEFAULT 0,
    qos_class VARCHAR(32),
    container_statuses JSONB DEFAULT '[]',
    labels JSONB DEFAULT '{}',
    annotations JSONB DEFAULT '{}',
    spec JSONB DEFAULT '{}',
    status JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT uk_k8s_pod UNIQUE (cluster_id, namespace_id, uid, deleted_at)
);

-- Indexes
CREATE INDEX idx_cmdb_k8s_pod_tenant ON cmdb_k8s_pod(tenant_id);
CREATE INDEX idx_cmdb_k8s_pod_cluster ON cmdb_k8s_pod(cluster_id);
CREATE INDEX idx_cmdb_k8s_pod_ns ON cmdb_k8s_pod(namespace_id);
CREATE INDEX idx_cmdb_k8s_pod_deploy ON cmdb_k8s_pod(deployment_id);
CREATE INDEX idx_cmdb_k8s_pod_name ON cmdb_k8s_pod(name);
CREATE INDEX idx_cmdb_k8s_pod_phase ON cmdb_k8s_pod(phase);
CREATE INDEX idx_cmdb_k8s_pod_node ON cmdb_k8s_pod(node_name);
CREATE INDEX idx_cmdb_k8s_pod_labels ON cmdb_k8s_pod USING GIN(labels);

-- ==================== CI/CD Resources ====================

-- CI/CD Pipeline Table - 流水线表
CREATE TABLE IF NOT EXISTS cmdb_cicd_pipeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id BIGINT NOT NULL DEFAULT 0,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    provider VARCHAR(64) DEFAULT 'tekton',
    namespace VARCHAR(128),
    pipeline_name VARCHAR(256),
    status VARCHAR(32) NOT NULL DEFAULT 'idle',
    last_run_id UUID,
    last_run_status VARCHAR(32),
    last_run_duration_ms BIGINT,
    last_run_at TIMESTAMPTZ,
    total_runs INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2),
    labels JSONB DEFAULT '{}',
    spec JSONB DEFAULT '{}',
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_cmdb_cicd_pipeline_tenant ON cmdb_cicd_pipeline(tenant_id);
CREATE INDEX idx_cmdb_cicd_pipeline_status ON cmdb_cicd_pipeline(status);
CREATE INDEX idx_cmdb_cicd_pipeline_labels ON cmdb_cicd_pipeline USING GIN(labels);

-- CI/CD Pipeline Run Table - 流水线运行表
CREATE TABLE IF NOT EXISTS cmdb_cicd_pipeline_run (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id BIGINT NOT NULL DEFAULT 0,
    pipeline_id UUID REFERENCES cmdb_cicd_pipeline(id),
    name VARCHAR(256) NOT NULL,
    uid VARCHAR(64) NOT NULL,
    namespace VARCHAR(128),
    pipeline_ref VARCHAR(256),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_ms BIGINT,
    triggered_by VARCHAR(64),
    trigger_reason VARCHAR(256),
    git_commit VARCHAR(64),
    git_branch VARCHAR(128),
    git_repository VARCHAR(512),
    labels JSONB DEFAULT '{}',
    annotations JSONB DEFAULT '{}',
    status_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_cmdb_cicd_run_tenant ON cmdb_cicd_pipeline_run(tenant_id);
CREATE INDEX idx_cmdb_cicd_run_pipeline ON cmdb_cicd_pipeline_run(pipeline_id);
CREATE INDEX idx_cmdb_cicd_run_status ON cmdb_cicd_pipeline_run(status);
CREATE INDEX idx_cmdb_cicd_run_start_time ON cmdb_cicd_pipeline_run(start_time DESC);
CREATE INDEX idx_cmdb_cicd_run_labels ON cmdb_cicd_pipeline_run USING GIN(labels);

-- CI/CD Task Run Table - 任务运行表
CREATE TABLE IF NOT EXISTS cmdb_cicd_task_run (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id BIGINT NOT NULL DEFAULT 0,
    pipeline_run_id UUID REFERENCES cmdb_cicd_pipeline_run(id),
    name VARCHAR(256) NOT NULL,
    uid VARCHAR(64) NOT NULL,
    task_ref VARCHAR(256),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_ms BIGINT,
    pod_name VARCHAR(256),
    container_name VARCHAR(256),
    retry_count INTEGER DEFAULT 0,
    reason VARCHAR(256),
    message TEXT,
    log_path VARCHAR(512),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_cmdb_cicd_task_run_pr ON cmdb_cicd_task_run(pipeline_run_id);
CREATE INDEX idx_cmdb_cicd_task_run_status ON cmdb_cicd_task_run(status);

-- ==================== Script Execution ====================

-- Script Execution Log Table - 脚本执行日志表
CREATE TABLE IF NOT EXISTS cmdb_script_execution (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id BIGINT NOT NULL DEFAULT 0,
    execution_id VARCHAR(64) NOT NULL,
    target_ci_id UUID NOT NULL REFERENCES cmdb_ci(id),
    script_content TEXT NOT NULL,
    script_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    stdout TEXT,
    stderr TEXT,
    exit_code INTEGER,
    duration_ms BIGINT,
    timeout_ms INTEGER,
    parameters JSONB DEFAULT '{}',
    executed_by VARCHAR(64) NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT
);

-- Indexes
CREATE INDEX idx_cmdb_script_exec_tenant ON cmdb_script_execution(tenant_id);
CREATE INDEX idx_cmdb_script_exec_target ON cmdb_script_execution(target_ci_id);
CREATE INDEX idx_cmdb_script_exec_status ON cmdb_script_execution(status);
CREATE INDEX idx_cmdb_script_exec_executed_at ON cmdb_script_execution(executed_at DESC);

-- ==================== Topology Cache ====================

-- Topology Cache Table - 拓扑缓存表
CREATE TABLE IF NOT EXISTS cmdb_topology_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key VARCHAR(256) NOT NULL UNIQUE,
    cache_type VARCHAR(64) NOT NULL,
    root_ci_id VARCHAR(64),
    data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_cmdb_topo_cache_key ON cmdb_topology_cache(cache_key);
CREATE INDEX idx_cmdb_topo_cache_type ON cmdb_topology_cache(cache_type);
CREATE INDEX idx_cmdb_topo_cache_expires ON cmdb_topology_cache(expires_at);

-- ==================== Comments ====================

COMMENT ON TABLE cmdb_ci IS 'Configuration Items - 配置项主表';
COMMENT ON TABLE cmdb_ci_relation IS 'CI Relations - 配置项关联关系';
COMMENT ON TABLE cmdb_ci_version IS 'CI Versions - 配置项版本历史';
COMMENT ON TABLE cmdb_host_group IS 'Host Groups - 主机组';
COMMENT ON TABLE cmdb_host IS 'Hosts - 主机资源';
COMMENT ON TABLE cmdb_k8s_cluster IS 'K8s Clusters - K8s 集群';
COMMENT ON TABLE cmdb_k8s_namespace IS 'K8s Namespaces - K8s 命名空间';
COMMENT ON TABLE cmdb_k8s_deployment IS 'K8s Deployments - K8s 部署';
COMMENT ON TABLE cmdb_k8s_pod IS 'K8s Pods - K8s Pod';
COMMENT ON TABLE cmdb_cicd_pipeline IS 'CI/CD Pipelines - 流水线';
COMMENT ON TABLE cmdb_cicd_pipeline_run IS 'CI/CD Pipeline Runs - 流水线运行';
COMMENT ON TABLE cmdb_cicd_task_run IS 'CI/CD Task Runs - 任务运行';
COMMENT ON TABLE cmdb_script_execution IS 'Script Executions - 脚本执行';
COMMENT ON TABLE cmdb_topology_cache IS 'Topology Cache - 拓扑缓存';
