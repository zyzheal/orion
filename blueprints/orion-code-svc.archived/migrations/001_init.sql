-- orion-code-svc Database Initialization Migration
-- Creates all tables needed for code management, build, artifact, and test reporting services

-- ============================================
-- Code Repository Tables
-- ============================================

-- Branch Policy Table
CREATE TABLE IF NOT EXISTS branch_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    repo_id VARCHAR(255) NOT NULL,
    branch_pattern VARCHAR(255) NOT NULL,
    require_review BOOLEAN DEFAULT true,
    required_approvals INTEGER DEFAULT 1,
    require_tests BOOLEAN DEFAULT false,
    require_status_checks BOOLEAN DEFAULT false,
    allow_force_push BOOLEAN DEFAULT false,
    allow_branch_deletion BOOLEAN DEFAULT false,
    enforce_admins BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_branch_policy_tenant_repo_pattern UNIQUE (tenant_id, repo_id, branch_pattern)
);

CREATE INDEX idx_branch_policies_tenant ON branch_policies(tenant_id);
CREATE INDEX idx_branch_policies_repo ON branch_policies(repo_id);

-- Code Ownership Table
CREATE TABLE IF NOT EXISTS code_ownership (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    repo_id VARCHAR(255) NOT NULL,
    file_pattern VARCHAR(1024) NOT NULL,
    owners JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_code_ownership_tenant_repo_pattern UNIQUE (tenant_id, repo_id, file_pattern)
);

CREATE INDEX idx_code_ownership_tenant ON code_ownership(tenant_id);
CREATE INDEX idx_code_ownership_repo ON code_ownership(repo_id);

-- ============================================
-- Build Cache Tables
-- ============================================

-- Build Cache Config
CREATE TABLE IF NOT EXISTS build_cache_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    pipeline_id VARCHAR(255),
    level VARCHAR(50) NOT NULL, -- 'global', 'pipeline', 'task'
    cache_key_template VARCHAR(512) NOT NULL,
    max_size_mb INTEGER DEFAULT 1000,
    max_age_days INTEGER DEFAULT 7,
    compression VARCHAR(20) DEFAULT 'gzip',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_build_cache_config_key UNIQUE (tenant_id, pipeline_id, level)
);

CREATE INDEX idx_build_cache_configs_tenant ON build_cache_configs(tenant_id);
CREATE INDEX idx_build_cache_configs_pipeline ON build_cache_configs(pipeline_id);

-- Build Cache Entries
CREATE TABLE IF NOT EXISTS build_cache_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES build_cache_configs(id) ON DELETE CASCADE,
    cache_key VARCHAR(512) NOT NULL,
    url TEXT,
    size_bytes BIGINT,
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_build_cache_entry_key UNIQUE (config_id, cache_key)
);

CREATE INDEX idx_build_cache_entries_config ON build_cache_entries(config_id);
CREATE INDEX idx_build_cache_entries_key ON build_cache_entries(cache_key);
CREATE INDEX idx_build_cache_entries_expires ON build_cache_entries(expires_at);

-- ============================================
-- Build Logs Tables
-- ============================================

-- Build Logs
CREATE TABLE IF NOT EXISTS build_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    build_id VARCHAR(255) NOT NULL,
    stage VARCHAR(100),
    task VARCHAR(100),
    log_content TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_build_logs_tenant ON build_logs(tenant_id);
CREATE INDEX idx_build_logs_build ON build_logs(build_id);
CREATE INDEX idx_build_logs_timestamp ON build_logs(timestamp);

-- Build Artifacts
CREATE TABLE IF NOT EXISTS build_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    build_id VARCHAR(255) NOT NULL,
    artifact_name VARCHAR(512) NOT NULL,
    artifact_type VARCHAR(100),
    size_bytes BIGINT,
    checksum VARCHAR(128),
    storage_path TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_build_artifacts_tenant ON build_artifacts(tenant_id);
CREATE INDEX idx_build_artifacts_build ON build_artifacts(build_id);

-- ============================================
-- Builder Images Tables
-- ============================================

-- Builder Images
CREATE TABLE IF NOT EXISTS builder_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    image_uri VARCHAR(512) NOT NULL,
    tag VARCHAR(100),
    description TEXT,
    registry_url VARCHAR(512),
    auth_username VARCHAR(255),
    auth_password_secret VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    last_pulled_at TIMESTAMP WITH TIME ZONE,
    pull_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_builder_image_name UNIQUE (tenant_id, name)
);

CREATE INDEX idx_builder_images_tenant ON builder_images(tenant_id);
CREATE INDEX idx_builder_images_status ON builder_images(status);

-- ============================================
-- Test Reports Tables
-- ============================================

-- Test Reports
CREATE TABLE IF NOT EXISTS test_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    build_id VARCHAR(255) NOT NULL,
    pipeline_id VARCHAR(255),
    run_id VARCHAR(255),
    report_type VARCHAR(50) NOT NULL, -- 'junit', 'coverage', 'integration'
    file_name VARCHAR(255),
    file_path TEXT,
    content JSONB,
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    skipped_tests INTEGER DEFAULT 0,
    duration_ms INTEGER,
    coverage_percentage DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_test_reports_tenant ON test_reports(tenant_id);
CREATE INDEX idx_test_reports_build ON test_reports(build_id);
CREATE INDEX idx_test_reports_pipeline ON test_reports(pipeline_id);

-- ============================================
-- Artifact Registry Tables
-- ============================================

-- Artifacts
CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'docker', 'maven', 'npm', 'generic'
    repository VARCHAR(255),
    registry_url VARCHAR(512),
    digest VARCHAR(512),
    size_bytes BIGINT,
    checksum VARCHAR(128),
    metadata JSONB DEFAULT '{}',
    tags JSONB DEFAULT '[]',
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_artifact_name_version UNIQUE (tenant_id, name, version)
);

CREATE INDEX idx_artifacts_tenant ON artifacts(tenant_id);
CREATE INDEX idx_artifacts_name ON artifacts(name);
CREATE INDEX idx_artifacts_type ON artifacts(type);
CREATE INDEX idx_artifacts_created_at ON artifacts(created_at);

-- ============================================
-- Build Pod Tables (K8s Build Executor)
-- ============================================

-- Build Pods
CREATE TABLE IF NOT EXISTS build_pods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    pod_name VARCHAR(255) NOT NULL,
    build_id VARCHAR(255) NOT NULL,
    namespace VARCHAR(100) DEFAULT 'orion-builds',
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, succeeded, failed, cancelled
    node_name VARCHAR(255),
    pod_ip VARCHAR(50),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    logs TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_build_pod_name UNIQUE (pod_name)
);

CREATE INDEX idx_build_pods_tenant ON build_pods(tenant_id);
CREATE INDEX idx_build_pods_build ON build_pods(build_id);
CREATE INDEX idx_build_pods_status ON build_pods(status);

-- ============================================
-- Webhook Execution Logs
-- ============================================

-- Webhook Executions
CREATE TABLE IF NOT EXISTS webhook_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    webhook_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB,
    status VARCHAR(50) DEFAULT 'pending', -- pending, success, failed
    status_code INTEGER,
    response_body TEXT,
    error_message TEXT,
    delivery_attempts INTEGER DEFAULT 1,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhook_executions_tenant ON webhook_executions(tenant_id);
CREATE INDEX idx_webhook_executions_webhook ON webhook_executions(webhook_id);
CREATE INDEX idx_webhook_executions_status ON webhook_executions(status);
CREATE INDEX idx_webhook_executions_executed_at ON webhook_executions(executed_at);

-- ============================================
-- Commit Status Tables
-- ============================================

-- Commit Status
CREATE TABLE IF NOT EXISTS commit_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    repo_id VARCHAR(255) NOT NULL,
    commit_sha VARCHAR(255) NOT NULL,
    context VARCHAR(255) NOT NULL,
    state VARCHAR(50) NOT NULL, -- pending, success, failure, error
    description TEXT,
    target_url TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_commit_status_commit_context UNIQUE (tenant_id, repo_id, commit_sha, context)
);

CREATE INDEX idx_commit_statuses_tenant ON commit_statuses(tenant_id);
CREATE INDEX idx_commit_statuses_repo ON commit_statuses(repo_id);
CREATE INDEX idx_commit_statuses_commit ON commit_statuses(commit_sha);

-- ============================================
-- Seed Data
-- ============================================

-- Default Builder Images
INSERT INTO builder_images (tenant_id, name, image_uri, tag, description, status) VALUES
('default-tenant', 'node', 'node:20-alpine', '20-alpine', 'Node.js 20 Alpine', 'active'),
('default-tenant', 'node', 'node:18-alpine', '18-alpine', 'Node.js 18 Alpine', 'active'),
('default-tenant', 'python', 'python:3.11-slim', '3.11-slim', 'Python 3.11 Slim', 'active'),
('default-tenant', 'golang', 'golang:1.21-alpine', '1.21-alpine', 'Go 1.21 Alpine', 'active')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- RLS should be enabled for all tenant-scoped tables
ALTER TABLE branch_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_cache_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_cache_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE builder_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commit_statuses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "branch_policies_tenant_policy" ON branch_policies FOR ALL USING (true);
CREATE POLICY "code_ownership_tenant_policy" ON code_ownership FOR ALL USING (true);
CREATE POLICY "build_cache_configs_tenant_policy" ON build_cache_configs FOR ALL USING (true);
CREATE POLICY "build_cache_entries_tenant_policy" ON build_cache_entries FOR ALL USING (true);
CREATE POLICY "build_logs_tenant_policy" ON build_logs FOR ALL USING (true);
CREATE POLICY "build_artifacts_tenant_policy" ON build_artifacts FOR ALL USING (true);
CREATE POLICY "builder_images_tenant_policy" ON builder_images FOR ALL USING (true);
CREATE POLICY "test_reports_tenant_policy" ON test_reports FOR ALL USING (true);
CREATE POLICY "artifacts_tenant_policy" ON artifacts FOR ALL USING (true);
CREATE POLICY "build_pods_tenant_policy" ON build_pods FOR ALL USING (true);
CREATE POLICY "webhook_executions_tenant_policy" ON webhook_executions FOR ALL USING (true);
CREATE POLICY "commit_statuses_tenant_policy" ON commit_statuses FOR ALL USING (true);