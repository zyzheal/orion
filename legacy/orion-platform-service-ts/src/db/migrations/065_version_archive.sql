-- Migration 065: Artifact Version Archive (Migration 338)
-- 版本归档中心：归档元数据、版本差异、保留策略

-- 1. artifact_archive 表
CREATE TABLE IF NOT EXISTS artifact_archive (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  artifact_id     VARCHAR(64) NOT NULL,
  version         VARCHAR(128) NOT NULL,
  status          VARCHAR(32) NOT NULL DEFAULT 'active',  -- active/archived/expired/deleted
  archive_type    VARCHAR(32) NOT NULL DEFAULT 'manual',  -- manual/auto/retention
  file_count      INTEGER NOT NULL DEFAULT 0,
  total_size      BIGINT NOT NULL DEFAULT 0,
  storage_path    VARCHAR(512) NOT NULL,
  tags            JSONB DEFAULT '[]',
  metadata        JSONB,
  archived_by     VARCHAR(64),
  archived_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RLS 多租户隔离
ALTER TABLE artifact_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_archive FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON artifact_archive USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_archive_artifact ON artifact_archive(artifact_id);
CREATE INDEX IF NOT EXISTS idx_archive_status ON artifact_archive(status);
CREATE INDEX IF NOT EXISTS idx_archive_expires ON artifact_archive(expires_at);
CREATE INDEX IF NOT EXISTS idx_archive_tenant ON artifact_archive(tenant_id);

-- 2. artifact_version_diff 表
CREATE TABLE IF NOT EXISTS artifact_version_diff (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  artifact_id     VARCHAR(64) NOT NULL,
  version_from    VARCHAR(128) NOT NULL,
  version_to      VARCHAR(128) NOT NULL,
  diff_type       VARCHAR(32) NOT NULL,    -- file/config/dependency/all
  diff_result     JSONB NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RLS 多租户隔离
ALTER TABLE artifact_version_diff ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_version_diff FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON artifact_version_diff USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_diff_artifact ON artifact_version_diff(artifact_id);
CREATE INDEX IF NOT EXISTS idx_diff_tenant ON artifact_version_diff(tenant_id);

-- 3. artifact_retention_policy 表
CREATE TABLE IF NOT EXISTS artifact_retention_policy (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  artifact_id     VARCHAR(64) NOT NULL,
  retention_days  INTEGER DEFAULT 90,
  max_versions    INTEGER DEFAULT 50,
  keep_release_tags BOOLEAN DEFAULT true,
  auto_archive    BOOLEAN DEFAULT true,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RLS 多租户隔离
ALTER TABLE artifact_retention_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_retention_policy FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON artifact_retention_policy USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_retention_artifact ON artifact_retention_policy(artifact_id);
CREATE INDEX IF NOT EXISTS idx_retention_tenant ON artifact_retention_policy(tenant_id);
