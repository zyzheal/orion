-- 051_create_teams.sql
-- Lightweight Team Model for batch permission management and CODEOWNERS resolution
-- Created: 2026-05-19

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,  -- URL-friendly identifier, e.g. "platform-sre"
    description TEXT,
    team_type VARCHAR(30) NOT NULL DEFAULT 'functional',  -- functional | project | sre | dba | security
    parent_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,  -- optional flat grouping
    external_id VARCHAR(100),  -- optional sync ID from external system (LDAP, etc.)
    metadata JSONB DEFAULT '{}',  -- extra fields: slack_channel, oncall_schedule, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(tenant_id, slug),
    CONSTRAINT chk_teams_type CHECK (team_type IN ('functional', 'project', 'sre', 'dba', 'security'))
);

CREATE INDEX idx_teams_tenant_id ON teams(tenant_id);
CREATE INDEX idx_teams_tenant_slug ON teams(tenant_id, slug);  -- tenant-scoped for findBySlug queries
CREATE INDEX idx_teams_parent_team_id ON teams(parent_team_id);
CREATE INDEX idx_teams_type ON teams(team_type);

-- Team membership table
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',  -- member | lead | admin
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    added_by UUID REFERENCES users(id),
    UNIQUE(team_id, user_id),
    CONSTRAINT chk_team_members_role CHECK (role IN ('member', 'lead', 'admin'))
);

CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_role ON team_members(role);

-- Team roles mapping (teams can have roles assigned, members inherit)
CREATE TABLE IF NOT EXISTS team_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    role_name VARCHAR(100) NOT NULL,  -- references roles.role_name (validated at service layer)
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES users(id),
    UNIQUE(team_id, role_name)
);

CREATE INDEX idx_team_roles_team_id ON team_roles(team_id);
CREATE INDEX idx_team_roles_role_name ON team_roles(role_name);  -- for getUserTeamRoleNames joins

-- Add comment
COMMENT ON TABLE teams IS 'Lightweight team model for batch permission management and CODEOWNERS resolution';
COMMENT ON COLUMN teams.team_type IS 'functional: permanent dept; project: temporary initiative; sre/dba/security: specialized ops';
COMMENT ON COLUMN team_members.role IS 'member: regular; lead: team lead with management perms; admin: full team admin';
