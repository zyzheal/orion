-- Lowcode templates and workflow versions
-- Created: 2026-08-13
-- Depends on: 080_create_workflow_tables (lowcode_workflow_definition)
--             139_create_lowcode_tables (lowcode_instances)

CREATE TABLE IF NOT EXISTS lowcode_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(128) DEFAULT '',
    thumbnail VARCHAR(512) DEFAULT '',
    definition TEXT DEFAULT '',
    tags VARCHAR(512) DEFAULT '',
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lowcode_workflow_version (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES lowcode_workflow_definition(id),
    version VARCHAR(32) NOT NULL,
    definition TEXT DEFAULT '',
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lowcode_templates_category ON lowcode_templates(category);
CREATE INDEX IF NOT EXISTS idx_lowcode_workflow_version_workflow ON lowcode_workflow_version(workflow_id);