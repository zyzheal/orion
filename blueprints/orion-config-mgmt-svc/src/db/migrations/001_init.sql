-- Orion Config Management Service Database Migration
-- 配置管理服务数据库初始化

-- ============================================================
-- 配置项表
-- ============================================================
CREATE TABLE IF NOT EXISTS config_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    item_type VARCHAR(50) NOT NULL DEFAULT 'application',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    description TEXT,
    app_id VARCHAR(255),
    environment VARCHAR(100) NOT NULL DEFAULT 'production',
    current_version INTEGER NOT NULL DEFAULT 1,
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'system',
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(key, environment, tenant_id)
);

CREATE INDEX idx_config_items_key_env ON config_items(key, environment);
CREATE INDEX idx_config_items_tenant ON config_items(tenant_id);
CREATE INDEX idx_config_items_status ON config_items(status);
CREATE INDEX idx_config_items_app_id ON config_items(app_id);

-- ============================================================
-- 配置版本表
-- ============================================================
CREATE TABLE IF NOT EXISTS config_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES config_items(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    value JSONB NOT NULL,
    change_reason TEXT,
    changed_by VARCHAR(255) NOT NULL,
    approval_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(config_id, version)
);

CREATE INDEX idx_config_versions_config ON config_versions(config_id);
CREATE INDEX idx_config_versions_approval ON config_versions(approval_id);

-- ============================================================
-- 特性开关表
-- ============================================================
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'disabled',
    rollout_percentage INTEGER CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    target_user_ids TEXT[],
    app_id VARCHAR(255),
    environment VARCHAR(100) NOT NULL DEFAULT 'production',
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(key, environment, app_id)
);

CREATE INDEX idx_feature_flags_key ON feature_flags(key);
CREATE INDEX idx_feature_flags_env ON feature_flags(environment);
CREATE INDEX idx_feature_flags_status ON feature_flags(status);
CREATE INDEX idx_feature_flags_app ON feature_flags(app_id);

-- ============================================================
-- 配置审批表
-- ============================================================
CREATE TABLE IF NOT EXISTS config_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    changes JSONB NOT NULL DEFAULT '[]',
    requester_id VARCHAR(255) NOT NULL,
    approver_ids TEXT[] NOT NULL DEFAULT '{}',
    comments TEXT,
    decided_by VARCHAR(255),
    decided_at TIMESTAMP WITH TIME ZONE,
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_config_approvals_status ON config_approvals(status);
CREATE INDEX idx_config_approvals_tenant ON config_approvals(tenant_id);
CREATE INDEX idx_config_approvals_requester ON config_approvals(requester_id);

-- ============================================================
-- GitOps 配置表
-- ============================================================
CREATE TABLE IF NOT EXISTS gitops_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_url VARCHAR(500) NOT NULL,
    branch VARCHAR(255) NOT NULL DEFAULT 'main',
    config_path VARCHAR(255) NOT NULL,
    sync_strategy VARCHAR(50) NOT NULL DEFAULT 'manual',
    last_sync_commit VARCHAR(255),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'system',
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(repo_url, branch, tenant_id)
);

CREATE INDEX idx_gitops_configs_tenant ON gitops_configs(tenant_id);
CREATE INDEX idx_gitops_configs_repo ON gitops_configs(repo_url);

-- ============================================================
-- 配置漂移记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS config_drifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES config_items(id) ON DELETE CASCADE,
    expected_value JSONB NOT NULL,
    actual_value JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'in_sync',
    drifted_fields TEXT[] NOT NULL DEFAULT '{}',
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'system',
    UNIQUE(config_id, detected_at)
);

CREATE INDEX idx_config_drifts_config ON config_drifts(config_id);
CREATE INDEX idx_config_drifts_status ON config_drifts(status);
CREATE INDEX idx_config_drifts_detected ON config_drifts(detected_at);

-- ============================================================
-- 审计日志表
-- ============================================================
CREATE TABLE IF NOT EXISTS config_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    changes JSONB,
    actor_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'system',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_config_audit_entity ON config_audit_logs(entity_type, entity_id);
CREATE INDEX idx_config_audit_actor ON config_audit_logs(actor_id);
CREATE INDEX idx_config_audit_created ON config_audit_logs(created_at);

-- 启用 RLS (行级安全策略)
ALTER TABLE config_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE gitops_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_drifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_audit_logs ENABLE ROW LEVEL SECURITY;

-- 默认策略：租户只能访问自己的数据
CREATE POLICY config_items_tenant_policy ON config_items USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY config_versions_tenant_policy ON config_versions USING (
    config_id IN (SELECT id FROM config_items WHERE tenant_id = current_setting('app.tenant_id', true))
);
CREATE POLICY feature_flags_tenant_policy ON feature_flags USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY config_approvals_tenant_policy ON config_approvals USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY gitops_configs_tenant_policy ON gitops_configs USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY config_drifts_tenant_policy ON config_drifts USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY config_audit_logs_tenant_policy ON config_audit_logs USING (tenant_id = current_setting('app.tenant_id', true));