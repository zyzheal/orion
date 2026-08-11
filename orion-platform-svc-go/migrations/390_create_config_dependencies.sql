-- Migration 390: config_dependencies table (support config dependency graph)
-- Stores directed edges between configuration entries forming a dependency graph.

CREATE TABLE IF NOT EXISTS config_dependencies (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    config_id VARCHAR(64) NOT NULL,
    depends_on VARCHAR(64) NOT NULL,
    relation VARCHAR(32) NOT NULL DEFAULT 'depends_on',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_dependencies_config ON config_dependencies(config_id);
CREATE INDEX IF NOT EXISTS idx_config_dependencies_depends_on ON config_dependencies(depends_on);
CREATE INDEX IF NOT EXISTS idx_config_dependencies_tenant ON config_dependencies(tenant_id);