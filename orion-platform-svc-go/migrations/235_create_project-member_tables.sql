-- Migration #235: Create project_members table
-- Tracks project membership with roles, permissions, and status.

CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    project_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'viewer',
    permissions JSONB DEFAULT '[]',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    invited_by VARCHAR(255) DEFAULT '',
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_tenant ON project_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(tenant_id, user_id);
