-- Project Member module tables

CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(tenant_id, project_id, user_id)
);
-- 补齐 project_members：235_create_project-member_tables.sql 的定义晚于 063_create_project_member_tables.sql，按序执行时表已存在
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]', ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active', ADD COLUMN IF NOT EXISTS invited_by VARCHAR(255) DEFAULT '', ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE;


CREATE INDEX IF NOT EXISTS idx_project_members_tenant_id ON project_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
