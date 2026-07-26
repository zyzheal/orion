-- ============================================================
-- LowCode Service Schema — Workflow Versions & Templates
-- ============================================================

-- Workflow Version snapshots
CREATE TABLE IF NOT EXISTS lowcode_workflow_version (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES lowcode_workflow_definition(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    version VARCHAR(64) NOT NULL,
    nodes JSONB NOT NULL DEFAULT '[]',
    edges JSONB NOT NULL DEFAULT '[]',
    commit_message TEXT,
    created_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lwv_workflow ON lowcode_workflow_version(workflow_id, created_at DESC);

-- Workflow Templates
CREATE TABLE IF NOT EXISTS lowcode_workflow_template (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    category VARCHAR(128),
    thumbnail TEXT,
    definition JSONB NOT NULL DEFAULT '{}',
    tags JSONB,
    usage_count INT NOT NULL DEFAULT 0,
    created_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lwt_tenant ON lowcode_workflow_template(tenant_id, created_at);
