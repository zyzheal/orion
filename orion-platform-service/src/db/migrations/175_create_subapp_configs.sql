-- Migration 175: SubApp Configuration Tables
--
-- Purpose: Store sub-application configurations for micro-frontend management
-- This enables page-based configuration without code changes

-- ============================================================
-- 1. SubApp Configuration Table
-- ============================================================

CREATE TABLE subapp_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,                    -- Display name
    key             VARCHAR(50) UNIQUE NOT NULL,              -- Unique identifier
    version         VARCHAR(20) DEFAULT '1.0.0',              -- Semantic version
    entry_dev       VARCHAR(500) NOT NULL,                    -- Development entry URL
    entry_prod      VARCHAR(500) NOT NULL,                    -- Production entry URL
    routes          JSONB NOT NULL DEFAULT '[]',              -- Array of route paths
    permissions     JSONB DEFAULT '[]',                       -- Required permissions
    keep_alive      BOOLEAN DEFAULT false,                    -- Keep alive on navigation
    preload         BOOLEAN DEFAULT false,                    -- Preload resources
    description     VARCHAR(500),                             -- Description
    icon            VARCHAR(50),                              -- Icon name
    status          VARCHAR(20) DEFAULT 'enabled',            -- enabled/disabled
    sort_order      INTEGER DEFAULT 0,                        -- Sort order
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subapp_configs_key ON subapp_configs(key);
CREATE INDEX idx_subapp_configs_status ON subapp_configs(status);
CREATE INDEX idx_subapp_configs_sort_order ON subapp_configs(sort_order);

-- Comments
COMMENT ON TABLE subapp_configs IS 'Sub-application configuration for micro-frontend management';
COMMENT ON COLUMN subapp_configs.name IS 'Display name in menu';
COMMENT ON COLUMN subapp_configs.key IS 'Unique identifier (e.g., dba, knowledge, visor)';
COMMENT ON COLUMN subapp_configs.entry_dev IS 'Development environment entry URL';
COMMENT ON COLUMN subapp_configs.entry_prod IS 'Production environment entry URL';
COMMENT ON COLUMN subapp_configs.routes IS 'Array of route paths that trigger this sub-app';
COMMENT ON COLUMN subapp_configs.keep_alive IS 'Keep sub-app alive when navigating away';
COMMENT ON COLUMN subapp_configs.preload IS 'Preload sub-app resources on main app load';

-- ============================================================
-- 2. SubApp Config History Table (Audit)
-- ============================================================

CREATE TABLE subapp_config_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subapp_key      VARCHAR(50) NOT NULL,
    action          VARCHAR(20) NOT NULL,                     -- created, updated, deleted, status_changed
    old_value       JSONB,                                    -- Previous configuration
    new_value       JSONB,                                    -- New configuration
    changed_by      UUID REFERENCES users(id),
    change_summary  VARCHAR(500),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subapp_config_history_key ON subapp_config_history(subapp_key);
CREATE INDEX idx_subapp_config_history_created ON subapp_config_history(created_at DESC);

COMMENT ON TABLE subapp_config_history IS 'Audit log for sub-app configuration changes';

-- ============================================================
-- 3. Insert Default SubApp Configurations (Module Federation 格式)
-- ============================================================

INSERT INTO subapp_configs (name, key, version, entry_dev, entry_prod, routes, status, sort_order, description) VALUES
-- orion-dba: Vue 3 + Vite + MF
('数据库管理', 'dba', '1.0.0', 'http://localhost:3030/assets/remoteEntry.js', '/orion-dba/assets/remoteEntry.js', '["/dba"]', 'enabled', 1, 'SQL审核、数据源管理'),
-- orion-knowledge: React + Vite + MF
('知识库', 'knowledge', '1.0.0', 'http://localhost:5173/assets/remoteEntry.js', '/orion-knowledge/assets/remoteEntry.js', '["/knowledge"]', 'enabled', 2, '文档管理、知识分享'),
-- orion-visor: Vue 2 + Vite + MF
('监控中心', 'visor', '1.0.0', 'http://localhost:3003/assets/remoteEntry.js', '/orion-visor/assets/remoteEntry.js', '["/visor"]', 'enabled', 3, '系统监控、告警管理');

-- ============================================================
-- 4. Migration Info
-- ============================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version             VARCHAR(20) PRIMARY KEY,
    applied_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description         TEXT
);

INSERT INTO schema_migrations (version, description)
VALUES ('175', 'Add subapp_configs and subapp_config_history tables')
ON CONFLICT (version) DO NOTHING;