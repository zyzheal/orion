-- Migration 003: Projects
-- Project management

CREATE TABLE IF NOT EXISTS projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  slug          VARCHAR(100) NOT NULL,
  owner_id      UUID REFERENCES users(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES users(id),
  UNIQUE(tenant_id, slug)
);
CREATE INDEX idx_projects_tenant ON projects(tenant_id);
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);

-- Project members
CREATE TABLE IF NOT EXISTS project_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          VARCHAR(50) NOT NULL DEFAULT 'developer',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
CREATE INDEX idx_project_members_project ON project_members(project_id);

-- Rollback:
-- DROP TABLE IF EXISTS project_members, projects;
