-- Orion Config Management Service - Namespace Support Migration
-- 配置管理服务 - 命名空间支持

-- ============================================================
-- 配置命名空间表
-- ============================================================
CREATE TABLE IF NOT EXISTS config_namespaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(500),
    git_repo_url VARCHAR(500),
    branch VARCHAR(100) DEFAULT 'main',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_config_namespaces_name ON config_namespaces(name);

-- ============================================================
-- 为 config_items 增加 namespace 关联
-- ============================================================
ALTER TABLE config_items
    ADD COLUMN IF NOT EXISTS namespace VARCHAR(100) DEFAULT 'default';

CREATE INDEX idx_config_items_namespace ON config_items(namespace);

-- ============================================================
-- 为 config_versions 增加 diff 和 commit_message
-- ============================================================
ALTER TABLE config_versions
    ADD COLUMN IF NOT EXISTS diff_from_previous JSONB,
    ADD COLUMN IF NOT EXISTS commit_message TEXT;

-- ============================================================
-- 为 config_items 增加 namespace 外键约束
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_items_namespace'
    ) THEN
        ALTER TABLE config_items
            ADD CONSTRAINT fk_config_items_namespace
            FOREIGN KEY (namespace) REFERENCES config_namespaces(name)
            ON DELETE SET DEFAULT;
    END IF;
END $$;
