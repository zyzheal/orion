-- Migration 014: Artifact Management
-- Artifact and version tracking

CREATE TABLE IF NOT EXISTS artifact_repositories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  type          VARCHAR(50) NOT NULL,
  url           VARCHAR(500) NOT NULL,
  credentials   JSONB,
  config        JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_artifact_repos_tenant ON artifact_repositories(tenant_id);

-- Artifact versions
CREATE TABLE IF NOT EXISTS artifact_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  repo_id       UUID REFERENCES artifact_repositories(id) ON DELETE SET NULL,
  name          VARCHAR(200) NOT NULL,
  version       VARCHAR(100) NOT NULL,
  type          VARCHAR(50) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'published',
  checksum      VARCHAR(128),
  size_bytes    BIGINT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  published_by  UUID REFERENCES users(id),
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_artifact_versions_tenant ON artifact_versions(tenant_id);
CREATE INDEX idx_artifact_versions_name ON artifact_versions(name);

-- Artifact promotions
CREATE TABLE IF NOT EXISTS artifact_promotions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id   UUID NOT NULL REFERENCES artifact_versions(id) ON DELETE CASCADE,
  from_env      VARCHAR(100) NOT NULL,
  to_env        VARCHAR(100) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_by   UUID REFERENCES users(id),
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rollback:
-- DROP TABLE IF EXISTS artifact_promotions, artifact_versions, artifact_repositories;
