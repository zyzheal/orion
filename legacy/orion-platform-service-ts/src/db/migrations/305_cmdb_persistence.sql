-- CMDB (Configuration Management Database) 迁移
-- 配置项管理: CI CRUD + 关系管理 + 版本追踪 + 审计日志

-- CI 类型枚举注释:
-- APPLICATION, SERVICE, DATABASE, SERVER, CONTAINER, K8S_CLUSTER,
-- K8S_DEPLOYMENT, K8S_POD, NETWORK, LOAD_BALANCER, STORAGE,
-- MIDDLEWARE, PIPELINE, ENVIRONMENT

-- CI 状态枚举注释:
-- ACTIVE, INACTIVE, DECOMMISSIONED, PENDING, MAINTENANCE

-- 关系类型枚举注释:
-- DEPENDS_ON, HOSTED_ON, CONNECTS_TO, BELONGS_TO, USES,
-- CONTAINS, VERSION_OF, DEPLOYED_TO, MONITORED_BY

-- 1. 配置项主表
CREATE TABLE IF NOT EXISTS cmdb_ci (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    ci_id VARCHAR(255) NOT NULL,
    ci_type VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    environment VARCHAR(100),
    owner VARCHAR(255),
    tags JSONB DEFAULT '[]',
    attributes JSONB DEFAULT '{}',
    version INTEGER DEFAULT 1,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    UNIQUE(tenant_id, ci_id)
);

-- 2. CI 关系表
CREATE TABLE IF NOT EXISTS cmdb_relation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    from_ci_id VARCHAR(255) NOT NULL,
    to_ci_id VARCHAR(255) NOT NULL,
    relation_type VARCHAR(100) NOT NULL,
    description TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- 3. CI 版本历史表
CREATE TABLE IF NOT EXISTS cmdb_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    ci_id VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL,
    changes TEXT,
    data JSONB NOT NULL DEFAULT '{}',
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. CI 审计日志表
CREATE TABLE IF NOT EXISTS cmdb_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    ci_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor VARCHAR(255),
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 索引: cmdb_ci
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_tenant ON cmdb_ci(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_type ON cmdb_ci(ci_type);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_status ON cmdb_ci(status);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_env ON cmdb_ci(environment);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_deleted ON cmdb_ci(deleted_at) WHERE deleted_at IS NULL;

-- 索引: cmdb_relation
CREATE INDEX IF NOT EXISTS idx_cmdb_rel_tenant ON cmdb_relation(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_rel_from ON cmdb_relation(from_ci_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_rel_to ON cmdb_relation(to_ci_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_rel_type ON cmdb_relation(relation_type);
CREATE INDEX IF NOT EXISTS idx_cmdb_rel_deleted ON cmdb_relation(deleted_at) WHERE deleted_at IS NULL;

-- 索引: cmdb_version
CREATE INDEX IF NOT EXISTS idx_cmdb_ver_tenant ON cmdb_version(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_ver_ci ON cmdb_version(ci_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_ver_ci_ver ON cmdb_version(ci_id, version DESC);

-- 索引: cmdb_audit_log
CREATE INDEX IF NOT EXISTS idx_cmdb_audit_tenant ON cmdb_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_audit_ci ON cmdb_audit_log(ci_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_audit_action ON cmdb_audit_log(action);
