-- 249_create_extension_point_tables.sql
-- Phase 0: Extension Point Framework (NeatLogic-inspired)
-- Tables for extension point registration, startup lifecycle tracking,
-- and extension event history.

CREATE TABLE IF NOT EXISTS extension_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    initialized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one extension point per tenant per name
CREATE UNIQUE INDEX IF NOT EXISTS uidx_extension_points_tenant_name
    ON extension_points(tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_extension_points_category
    ON extension_points(category);
CREATE INDEX IF NOT EXISTS idx_extension_points_status
    ON extension_points(status);
CREATE INDEX IF NOT EXISTS idx_extension_points_tenant
    ON extension_points(tenant_id);
CREATE INDEX IF NOT EXISTS idx_extension_points_priority
    ON extension_points(priority);
CREATE INDEX IF NOT EXISTS idx_extension_points_enabled
    ON extension_points(enabled);

CREATE TABLE IF NOT EXISTS startup_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    extension_id VARCHAR(128) NOT NULL,
    name VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    duration_ms BIGINT DEFAULT 0,
    error TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_startup_tasks_extension
    ON startup_tasks(extension_id);
CREATE INDEX IF NOT EXISTS idx_startup_tasks_status
    ON startup_tasks(status);
CREATE INDEX IF NOT EXISTS idx_startup_tasks_created
    ON startup_tasks(created_at DESC);

-- Down migration (for rollback): 249_create_extension_point_tables_down.sql
-- DROP INDEX IF EXISTS idx_startup_tasks_created;
-- DROP INDEX IF EXISTS idx_startup_tasks_status;
-- DROP INDEX IF EXISTS idx_startup_tasks_extension;
-- DROP INDEX IF EXISTS idx_extension_points_enabled;
-- DROP INDEX IF EXISTS idx_extension_points_priority;
-- DROP INDEX IF EXISTS idx_extension_points_tenant;
-- DROP INDEX IF EXISTS idx_extension_points_status;
-- DROP INDEX IF EXISTS idx_extension_points_category;
-- DROP INDEX IF EXISTS uidx_extension_points_tenant_name;
-- DROP TABLE IF EXISTS startup_tasks;
-- DROP TABLE IF EXISTS extension_points;
