-- CMDB Relation Type and Archive Support
-- Flyway Migration V1.0.2
-- Description: Adds relation type management table and archive support for CIs

-- ==================== Relation Type Table ====================

-- Relation Type Table - 关系类型定义表
CREATE TABLE IF NOT EXISTS cmdb_relation_type (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id BIGINT NOT NULL DEFAULT 0,
    name VARCHAR(64) NOT NULL,
    description TEXT,
    category VARCHAR(32) NOT NULL DEFAULT 'CUSTOM',
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_cmdb_relation_type UNIQUE (tenant_id, name, deleted_at)
);

-- Indexes
CREATE INDEX idx_cmdb_relation_type_tenant ON cmdb_relation_type(tenant_id);
CREATE INDEX idx_cmdb_relation_type_name ON cmdb_relation_type(name);
CREATE INDEX idx_cmdb_relation_type_category ON cmdb_relation_type(category);

COMMENT ON TABLE cmdb_relation_type IS 'CMDB Relation Types - CMDB 关系类型定义表';

-- ==================== Archive Support for CIs ====================

-- Add archived_at column to cmdb_ci if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'cmdb_ci' AND column_name = 'archived_at') THEN
        ALTER TABLE cmdb_ci ADD COLUMN archived_at TIMESTAMPTZ;
        CREATE INDEX idx_cmdb_ci_archived_at ON cmdb_ci(archived_at) WHERE archived_at IS NOT NULL;
    END IF;
END $$;

-- ==================== Seed Default Relation Types ====================

-- Insert default system relation types for tenant 0 (shared/system tenant)
INSERT INTO cmdb_relation_type (tenant_id, name, description, category, is_system)
VALUES
    (0, 'DEPENDS_ON', '应用/服务依赖', 'DEPENDENCY', true),
    (0, 'HOSTED_ON', '部署在...上', 'DEPLOYMENT', true),
    (0, 'CONNECTS_TO', '网络连接', 'CONNECTION', true),
    (0, 'BELONGS_TO', '归属关系', 'CONTAINMENT', true),
    (0, 'USES', '使用关系', 'DEPENDENCY', true),
    (0, 'CONTAINS', '包含关系', 'CONTAINMENT', true),
    (0, 'VERSION_OF', '版本关系', 'VERSION', true),
    (0, 'DEPLOYED_TO', '部署到', 'DEPLOYMENT', true),
    (0, 'MONITORED_BY', '被...监控', 'CONNECTION', true)
ON CONFLICT (tenant_id, name) DO NOTHING;
