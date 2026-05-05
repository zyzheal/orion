-- 103: Artifact Operations
-- 制品操作记录、制品扫描、制品保留策略

-- artifact_operations 表（制品操作记录）
CREATE TABLE IF NOT EXISTS artifact_operations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  artifact_id       VARCHAR(200) NOT NULL,
  operation_type    VARCHAR(50) NOT NULL,                      -- upload, download, delete, copy, promote, tag
  source_registry   VARCHAR(500),
  target_registry   VARCHAR(500),
  artifact_size     BIGINT DEFAULT 0,
  checksum          VARCHAR(100),
  performed_by      VARCHAR(100) NOT NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'completed',  -- completed, failed, in_progress
  error_message     TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_artifact_operations_tenant ON artifact_operations(tenant_id);
CREATE INDEX idx_artifact_operations_artifact ON artifact_operations(artifact_id);
CREATE INDEX idx_artifact_operations_type ON artifact_operations(operation_type);
CREATE INDEX idx_artifact_operations_status ON artifact_operations(status);
CREATE INDEX idx_artifact_operations_created ON artifact_operations(created_at DESC);

-- artifact_scans 表（制品扫描结果）
CREATE TABLE IF NOT EXISTS artifact_scans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  artifact_id       VARCHAR(200) NOT NULL,
  scan_type         VARCHAR(50) NOT NULL DEFAULT 'vulnerability', -- vulnerability, malware, license, size
  scanner_name      VARCHAR(100) NOT NULL,
  scan_status       VARCHAR(30) NOT NULL DEFAULT 'pending',    -- pending, running, completed, failed
  critical_count    INT NOT NULL DEFAULT 0,
  high_count        INT NOT NULL DEFAULT 0,
  medium_count      INT NOT NULL DEFAULT 0,
  low_count         INT NOT NULL DEFAULT 0,
  findings          JSONB NOT NULL DEFAULT '[]',
  passed            BOOLEAN NOT NULL DEFAULT true,
  scanned_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata          JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_artifact_scans_tenant ON artifact_scans(tenant_id);
CREATE INDEX idx_artifact_scans_artifact ON artifact_scans(artifact_id);
CREATE INDEX idx_artifact_scans_type ON artifact_scans(scan_type);
CREATE INDEX idx_artifact_scans_status ON artifact_scans(scan_status);
CREATE INDEX idx_artifact_scans_passed ON artifact_scans(passed);

-- artifact_retention_policies 表（制品保留策略）
CREATE TABLE IF NOT EXISTS artifact_retention_policies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_name       VARCHAR(200) NOT NULL,
  scope_type        VARCHAR(50) NOT NULL DEFAULT 'global',     -- global, project, registry, tag
  scope_id          VARCHAR(200),
  max_count         INT,
  max_age_days      INT,
  min_count         INT NOT NULL DEFAULT 1,
  filter_tags       JSONB NOT NULL DEFAULT '[]',
  exclude_tags      JSONB NOT NULL DEFAULT '[]',
  enabled           BOOLEAN NOT NULL DEFAULT true,
  last_executed_at  TIMESTAMPTZ,
  last_pruned_count INT DEFAULT 0,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_artifact_retention_policies_tenant ON artifact_retention_policies(tenant_id);
CREATE INDEX idx_artifact_retention_policies_scope ON artifact_retention_policies(scope_type, scope_id);
CREATE INDEX idx_artifact_retention_policies_enabled ON artifact_retention_policies(enabled) WHERE enabled = true;

-- RLS
ALTER TABLE artifact_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_artifact_operations ON artifact_operations
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_artifact_scans ON artifact_scans
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_artifact_retention_policies ON artifact_retention_policies
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
