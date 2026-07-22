-- Migration 009: Code Repositories
-- Code repository connections and configurations

CREATE TABLE IF NOT EXISTS code_repositories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  adapter_id    UUID,
  name          VARCHAR(200) NOT NULL,
  url           VARCHAR(500) NOT NULL,
  provider      VARCHAR(50) NOT NULL,
  branch        VARCHAR(200) NOT NULL DEFAULT 'main',
  webhook_secret VARCHAR(255),
  config        JSONB NOT NULL DEFAULT '{}',
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_code_repos_tenant ON code_repositories(tenant_id);
CREATE INDEX idx_code_repos_project ON code_repositories(project_id);

-- Pull requests
CREATE TABLE IF NOT EXISTS pull_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id       UUID NOT NULL REFERENCES code_repositories(id) ON DELETE CASCADE,
  provider_pr_id VARCHAR(100) NOT NULL,
  title         VARCHAR(500) NOT NULL,
  source_branch VARCHAR(200) NOT NULL,
  target_branch VARCHAR(200) NOT NULL,
  author        VARCHAR(200),
  status        VARCHAR(20) NOT NULL DEFAULT 'open',
  url           VARCHAR(500),
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prs_repo ON pull_requests(repo_id);
CREATE INDEX idx_prs_status ON pull_requests(status);

-- Rollback:
-- DROP TABLE IF EXISTS pull_requests, code_repositories;
