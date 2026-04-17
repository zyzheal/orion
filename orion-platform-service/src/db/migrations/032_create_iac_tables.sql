-- Migration 032: IaC Management (M20)
-- Creates tables for IaC workspaces, plans, state versions, and modules

-- IaC Workspace 主表
CREATE TABLE IF NOT EXISTS iac_workspaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  project_id      UUID NOT NULL,
  environment     VARCHAR(20) NOT NULL,              -- dev | staging | prod | dr
  state_path      VARCHAR(500) NOT NULL DEFAULT '',
  variables       JSONB NOT NULL DEFAULT '{}',
  locked_by       UUID,                              -- User ID who holds the lock
  status          VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | locked | destroyed
  provider        VARCHAR(20) NOT NULL DEFAULT 'terraform', -- terraform | pulumi | helm
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_iac_workspaces_project ON iac_workspaces(project_id);
CREATE INDEX idx_iac_workspaces_env ON iac_workspaces(environment);
CREATE INDEX idx_iac_workspaces_status ON iac_workspaces(status);
CREATE INDEX idx_iac_workspaces_provider ON iac_workspaces(provider);
COMMENT ON TABLE iac_workspaces IS 'IaC workspace management for Terraform/Pulumi/Helm';

-- IaC Plan 执行计划表
CREATE TABLE IF NOT EXISTS iac_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES iac_workspaces(id) ON DELETE CASCADE,
  commit_sha      VARCHAR(64) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed | applied
  resource_changes JSONB NOT NULL DEFAULT '{}',
  cost_estimate   JSONB NOT NULL DEFAULT '{}',
  ai_review       JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_iac_plans_workspace ON iac_plans(workspace_id);
CREATE INDEX idx_iac_plans_status ON iac_plans(status);
CREATE INDEX idx_iac_plans_expires ON iac_plans(expires_at);
COMMENT ON TABLE iac_plans IS 'IaC execution plans with resource changes and cost estimates';

-- IaC State Version 状态版本表
CREATE TABLE IF NOT EXISTS iac_state_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES iac_workspaces(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
  commit_sha      VARCHAR(64) NOT NULL,
  author          VARCHAR(255) NOT NULL,
  size            INT NOT NULL                     -- State file size in bytes
);
CREATE INDEX idx_iac_state_versions_workspace ON iac_state_versions(workspace_id);
CREATE INDEX idx_iac_state_versions_version ON iac_state_versions(workspace_id, version DESC);
COMMENT ON TABLE iac_state_versions IS 'IaC state version history per workspace';

-- IaC Module 模块注册表
CREATE TABLE IF NOT EXISTS iac_modules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL UNIQUE,
  version         VARCHAR(50) NOT NULL,
  source          VARCHAR(500) NOT NULL,           -- Git URL or registry path
  dependencies    JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_iac_modules_name ON iac_modules(name);
COMMENT ON TABLE iac_modules IS 'IaC reusable module registry';
