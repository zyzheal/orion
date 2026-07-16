-- TASK-1005: Artifact Registry Database Schema
-- 创建制品仓库数据库表结构

-- 制品类型枚举
CREATE TYPE artifact_type AS ENUM (
    'DOCKER_IMAGE',
    'HELM_CHART',
    'FUNCTION_PACKAGE',
    'MODEL_FILE',
    'PLUGIN_PACKAGE',
    'CONFIG_FILE',
    'BUILD_OUTPUT',
    'TEST_REPORT'
);

-- 制品状态枚举
CREATE TYPE artifact_status AS ENUM (
    'UPLOADING',
    'AVAILABLE',
    'DEPRECATED',
    'DELETED',
    'QUARANTINED'
);

-- 制品仓库表
CREATE TABLE artifact_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    namespace VARCHAR(100) NOT NULL,
    version VARCHAR(100) NOT NULL,
    artifact_type artifact_type NOT NULL,
    status artifact_status NOT NULL DEFAULT 'AVAILABLE',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    checksum_sha256 VARCHAR(64),
    checksum_sha512 VARCHAR(128),
    metadata JSONB DEFAULT '{}',
    storage_path VARCHAR(500) NOT NULL,
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- 唯一约束：namespace + name + version
    UNIQUE(namespace, name, version)
);

-- 制品标签表
CREATE TABLE artifact_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifact_registry(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(artifact_id, tag)
);

-- 制品下载记录表
CREATE TABLE artifact_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifact_registry(id) ON DELETE CASCADE,
    downloaded_by VARCHAR(100) NOT NULL,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- 制品元数据表
CREATE TABLE artifact_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifact_registry(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(artifact_id, key)
);

-- 创建索引
CREATE INDEX idx_artifact_registry_namespace ON artifact_registry(namespace);
CREATE INDEX idx_artifact_registry_name ON artifact_registry(name);
CREATE INDEX idx_artifact_registry_type ON artifact_registry(artifact_type);
CREATE INDEX idx_artifact_registry_status ON artifact_registry(status);
CREATE INDEX idx_artifact_registry_created_at ON artifact_registry(created_at);
CREATE INDEX idx_artifact_tags_artifact_id ON artifact_tags(artifact_id);
CREATE INDEX idx_artifact_downloads_artifact_id ON artifact_downloads(artifact_id);
CREATE INDEX idx_artifact_metadata_artifact_id ON artifact_metadata(artifact_id);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_artifact_registry_updated_at 
    BEFORE UPDATE ON artifact_registry 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 创建软删除触发器
CREATE OR REPLACE FUNCTION soft_delete_artifact()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        -- 软删除时更新状态
        UPDATE artifact_registry 
        SET status = 'DELETED' 
        WHERE id = OLD.id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER soft_delete_artifact_trigger
    BEFORE UPDATE ON artifact_registry
    FOR EACH ROW
    EXECUTE FUNCTION soft_delete_artifact();

-- ============================================================
-- Tenant isolation: add tenant_id to all tables
-- ============================================================

ALTER TABLE artifact_registry ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_artifact_registry_tenant_id ON artifact_registry(tenant_id);

ALTER TABLE artifact_tags ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_artifact_tags_tenant_id ON artifact_tags(tenant_id);

ALTER TABLE artifact_downloads ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_artifact_downloads_tenant_id ON artifact_downloads(tenant_id);

ALTER TABLE artifact_metadata ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_artifact_metadata_tenant_id ON artifact_metadata(tenant_id);