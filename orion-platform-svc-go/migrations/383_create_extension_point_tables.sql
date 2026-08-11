-- Migration 383: extension-point framework tables (was AutoMigrate only)

CREATE TABLE IF NOT EXISTS extension_points (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT '',
    name VARCHAR(128) NOT NULL,
    category VARCHAR(32) NOT NULL,
    description TEXT,
    handler_type VARCHAR(32) NOT NULL DEFAULT 'builtin',
    config JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    priority INT DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'registered',
    error TEXT,
    registered_at TIMESTAMP DEFAULT NOW(),
    initialized_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extension_points_name_tenant ON extension_points(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_extension_points_category ON extension_points(category);
CREATE INDEX IF NOT EXISTS idx_extension_points_enabled ON extension_points(enabled);

CREATE TABLE IF NOT EXISTS startup_tasks (
    id UUID PRIMARY KEY,
    extension_id VARCHAR(128) NOT NULL,
    name VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    duration_ms BIGINT DEFAULT 0,
    error TEXT,
    started_at TIMESTAMP DEFAULT NOW(),
    finished_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_startup_tasks_extension ON startup_tasks(extension_id);
CREATE INDEX IF NOT EXISTS idx_startup_tasks_status ON startup_tasks(status);