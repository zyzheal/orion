-- Team module tables

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    team_type VARCHAR(50),
    parent_team_id VARCHAR(255),
    external_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by VARCHAR(255),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_teams_tenant_id ON teams(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teams_parent_team_id ON teams(parent_team_id);
CREATE INDEX IF NOT EXISTS idx_teams_team_type ON teams(team_type);

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    team_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
    added_by VARCHAR(255),
    UNIQUE(tenant_id, team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_tenant_id ON team_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

CREATE TABLE IF NOT EXISTS team_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    team_id VARCHAR(255) NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    granted_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_team_roles_tenant_id ON team_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_roles_team_id ON team_roles(team_id);
